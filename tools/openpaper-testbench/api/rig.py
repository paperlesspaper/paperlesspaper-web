"""Persistent frame profiles, stable USB identities and perspective calibration."""
import hashlib
import json
import os
from pathlib import Path
import threading
from typing import Literal

import cv2
import numpy as np
from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from serial.tools import list_ports
from supercamera import discover as discover_supercameras


class Point(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class FrameProfile(BaseModel):
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,40}$')
    name: str = Field(min_length=1, max_length=80)
    camera: str | None = None
    rotation: Literal[0, 90, 180, 270] = 0
    relay: str | None = None
    serial: str | None = None
    corners: list[Point] = Field(default_factory=lambda: [Point(x=x, y=y) for x, y in [(0,0),(1,0),(1,1),(0,1)]], min_length=4, max_length=4)

    @model_validator(mode='after')
    def valid_quad(self):
        p = np.array([[v.x, v.y] for v in self.corners], np.float32)
        edges = np.roll(p, -1, axis=0) - p
        cross = edges[:,0] * np.roll(edges[:,1], -1) - edges[:,1] * np.roll(edges[:,0], -1)
        if not np.all(cross > .0001) or cv2.contourArea(p) < .001:
            raise ValueError('Ecken im Uhrzeigersinn: oben links, oben rechts, unten rechts, unten links; kein gekreuztes/zu kleines Viereck')
        return self


class RigConfig(BaseModel):
    revision: int = Field(default=0, ge=0)
    frames: list[FrameProfile] = Field(min_length=1, max_length=8)
    detail_camera: str | None = None
    light_device: str | None = None

    @model_validator(mode='after')
    def unique(self):
        if len({f.id for f in self.frames}) != len(self.frames):
            raise ValueError('Rahmen-IDs müssen eindeutig sein')
        cameras = [f.camera for f in self.frames if f.camera] + ([self.detail_camera] if self.detail_camera else [])
        ports = [p for f in self.frames for p in (f.relay, f.serial) if p] + ([self.light_device] if self.light_device else [])
        if len(cameras) != len(set(cameras)) or len(ports) != len(set(ports)):
            raise ValueError('Jedes USB-Gerät darf nur einmal zugeordnet sein')
        return self


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.flush()
        os.fsync(out.fileno())
    temporary.replace(path)


def inventory(demo=False, video_root=Path('/dev/v4l/by-path'), video_sysfs=Path('/sys/class/video4linux'), serial_root=Path('/dev/serial/by-path')):
    if demo:
        return {'cameras': [{'id': f'demo-camera-{i}', 'name': n, 'device': f'demo-camera-{i}'} for i,n in enumerate(['Webcam A', 'Webcam B', 'Endoskop'],1)], 'ports': []}
    cameras, seen = [], set()
    # by-path distinguishes identical cameras without serial numbers. Keep USB sockets fixed.
    for path in sorted(video_root.glob('*')):
        real = str(path.resolve())
        if real in seen:
            continue
        # UVC's primary video node is index 0; index 1 is metadata. Read sysfs
        # rather than opening the camera: even a timed-out v4l2-ctl can remain
        # stuck in an uninterruptible USB ioctl and block device discovery.
        node = video_sysfs / Path(real).name
        try:
            if (node / 'index').read_text().strip() != '0':
                continue
            name = (node / 'name').read_text().strip()
        except OSError:
            continue
        seen.add(real)
        cameras.append({'id':str(path),'name':name or Path(real).name,'device':real})
    aliases = {str(p.resolve()):str(p) for p in sorted(serial_root.glob('*'))}
    ports = []
    for p in list_ports.comports():
        if p.device not in aliases:
            continue  # Never persist unstable ttyUSB numbers.
        ports.append({'id':aliases[p.device], 'name':p.description, 'device':p.device,
                      'vid':p.vid, 'pid':p.pid, 'serial_number':p.serial_number})
    return {'cameras':cameras + discover_supercameras(), 'ports':ports}


def orient(image, rotation=0):
    modes = {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}
    return cv2.rotate(image, modes[rotation]) if rotation else image


def rotate_corners(corners, rotation):
    points = [p.model_copy() for p in corners]
    for _ in range((rotation % 360)//90):
        points = [Point(x=1-p.y, y=p.x) for p in points]
        points = points[-1:] + points[:-1]
    return points


def rectify(image, corners):
    h,w = image.shape[:2]
    src = np.float32([[p.x*(w-1),p.y*(h-1)] for p in corners])
    width = round(max(np.linalg.norm(src[1]-src[0]), np.linalg.norm(src[2]-src[3])))
    height = round(max(np.linalg.norm(src[3]-src[0]), np.linalg.norm(src[2]-src[1])))
    if min(width,height) < 8:
        raise HTTPException(422, 'Displayausschnitt muss mindestens 8 × 8 Pixel groß sein')
    dst = np.float32([[0,0],[width-1,0],[width-1,height-1],[0,height-1]])
    return cv2.warpPerspective(image, cv2.getPerspectiveTransform(src,dst), (width,height))


class Rig:
    def __init__(self, data, camera_factory, demo=False):
        self.path = data / 'rig.json'
        self.data, self.camera_factory, self.demo = data, camera_factory, demo
        self.lock = threading.RLock()
        self.active_actions = 0
        self.cameras, self.workers, self.relays, self.serials, self.nights = {}, {}, {}, {}, {}
        self.config = RigConfig.model_validate_json(self.path.read_text()) if self.path.exists() else RigConfig(frames=[FrameProfile(id='frame-1',name='Rahmen 1'),FrameProfile(id='frame-2',name='Rahmen 2')])

    def snapshot(self):
        with self.lock:
            return self.config.model_copy(deep=True)

    def profile(self, frame_id):
        for f in self.snapshot().frames:
            if f.id == frame_id:
                return f
        raise HTTPException(404, 'Rahmen nicht gefunden')

    def save(self, config):
        with self.lock:
            if config.revision != self.config.revision:
                raise HTTPException(409, 'Zuordnung wurde in einem anderen Browser geändert. Neu laden.')
            devices = inventory(self.demo)
            old = self.config.model_dump()
            old_ids = {v for f in old['frames'] for v in (f['camera'],f['relay'],f['serial']) if v} | {old['detail_camera'],old['light_device']}
            cameras = {d['id'] for d in devices['cameras']}
            ports = {d['id']:d for d in devices['ports']}
            for f in config.frames:
                for value, kind in [(f.camera,'camera'), (f.relay,'relay'), (f.serial,'serial')]:
                    self.validate_device(value,kind,cameras,ports,old_ids)
            self.validate_device(config.detail_camera,'camera',cameras,ports,old_ids)
            self.validate_device(config.light_device,'relay',cameras,ports,old_ids)
            if any(n.status()['status'] in ('starting','settling','capturing','restoring') for n in self.nights.values()):
                raise HTTPException(409, 'Zuerst Nachtaufnahme beenden')
            config = config.model_copy(deep=True)
            old_frames = {f.id: f for f in self.config.frames}
            for frame in config.frames:
                previous = old_frames.get(frame.id)
                if previous and frame.rotation != previous.rotation:
                    frame.corners = rotate_corners(frame.corners, frame.rotation - previous.rotation)
            config.revision += 1
            atomic_json(self.path, config.model_dump())
            self.config = config
            wanted = {f.camera for f in config.frames} | {config.detail_camera}
            for key in list(self.cameras):
                if key not in wanted:
                    self.cameras[key].stop.set()
                    self.workers[key].join(5)
                    if self.workers[key].is_alive():
                        continue  # Keep ownership until a blocked driver read returns.
                    self.cameras.pop(key); self.workers.pop(key)
                    self.nights.pop(key, None)
            wanted_serials = {f.serial for f in config.frames}
            for key in list(self.serials):
                if key not in wanted_serials:
                    self.serials.pop(key).close()
            return self.snapshot()

    @staticmethod
    def validate_device(value,kind,cameras,ports,old_ids):
        if value is None:
            return
        if kind == 'camera' and value in cameras:
            return
        expected = (0x10c4,0xea60) if kind == 'serial' else (0x1a86,0x7523)
        if value in ports and (ports[value]['vid'],ports[value]['pid']) == expected:
            return
        if value in old_ids and value not in cameras and value not in ports:
            return  # Retain unplugged assignments, never substitute another device.
        raise HTTPException(422, 'USB-Gerät fehlt oder passt nicht zur Rolle')

    def camera(self, frame_id=None, detail=False):
        key = self.snapshot().detail_camera if detail else self.profile(frame_id).camera
        return self.camera_key(key)

    def camera_key(self, key):
        if not key:
            raise HTTPException(409, 'Zuerst eine Kamera zuordnen')
        with self.lock:
            if key not in self.cameras:
                camera = self.camera_factory(key, self.data / ('camera-'+hashlib.sha256(key.encode()).hexdigest()[:16]+'.json'))
                self.cameras[key] = camera
                self.workers[key] = threading.Thread(target=camera.run, daemon=True)
                self.workers[key].start()
            return self.cameras[key]

    def relay(self, frame_id):
        from hardware import Relay
        key = self.profile(frame_id).relay
        if not key:
            raise HTTPException(409, 'Diesem Rahmen ist kein Relais zugeordnet')
        with self.lock:
            if key not in self.relays:
                self.relays[key] = Relay(device=key)
            return self.relays[key]

    def serial(self, frame_id):
        from hardware import SerialMonitor
        key = self.profile(frame_id).serial
        if not key:
            raise HTTPException(409, 'Diesem Rahmen ist kein UART zugeordnet')
        with self.lock:
            if key not in self.serials:
                self.serials[key] = SerialMonitor(device=key)
                self.serials[key].start()
            return self.serials[key]

    def reference_path(self, profile):
        fingerprint = hashlib.sha256(json.dumps([profile.camera,profile.rotation,[p.model_dump() for p in profile.corners]],sort_keys=True).encode()).hexdigest()[:16]
        return self.data / f'reference-{profile.id}-{fingerprint}.png'

    def close(self):
        for n in self.nights.values(): n.close()
        for c in self.cameras.values(): c.stop.set()
        for s in self.serials.values(): s.close()
        for w in self.workers.values(): w.join(5)
        self.cameras.clear(); self.workers.clear(); self.serials.clear(); self.nights.clear()
