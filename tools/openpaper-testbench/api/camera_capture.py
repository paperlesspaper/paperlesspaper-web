"""Demand-driven camera capture and shared, bounded JPEG rendering."""
import json
import math
import os
from pathlib import Path
import threading
import time

import cv2
import numpy as np
from fastapi import HTTPException

from camera_controls import CameraControls
from camera_quality import capture_sizes, preview_image
from gray_calibration import GrayCalibration
from rig import orient, rectify
from supercamera import SupercameraCapture


class Camera:
    def __init__(self, device=None, controls_path=None):
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.wake = threading.Event()
        self.condition = threading.Condition(self.lock)
        self.sequence = 0
        self.frame = None
        self.updated = 0.0
        self.error = None
        self.native_resolution = None
        self.preview_resolution = None
        self.requested_resolution = None
        self.quality_note = None
        self.reported_fps = None
        self.fps_note = None
        self.device = device or os.getenv('CAMERA_DEVICE', '/dev/video0')
        self.fps = max(1, min(30, int(os.getenv('CAMERA_FPS', '2'))))
        self.idle_seconds = max(1, float(os.getenv('CAMERA_IDLE_SECONDS', '15')))
        self.demo = os.getenv('DEMO_MODE', '0') == '1'
        self.demand_until = time.monotonic() + self.idle_seconds if self.demo else 0
        self.high_until = 0
        self.frame_quality = None
        self.paused = not self.demo
        self.controls = CameraControls(self.device, controls_path or Path(os.getenv('DATA_DIR', '/data')) / 'camera-controls.json')
        self.gray = GrayCalibration(self.controls.settings_file.with_suffix('.gray.json'))
        self.render_lock = threading.Lock()
        self.render_sequence = None
        self.render_cache = {}

    def run(self):
        cap, mode = None, None
        try:
            while not self.stop.is_set():
                started = time.monotonic()
                with self.lock:
                    active = started < self.demand_until
                    quality = 'high' if started < self.high_until else 'standard'
                if not active:
                    if cap is not None:
                        cap.release()
                        cap = None
                    with self.condition:
                        self.paused, self.frame, self.frame_quality = True, None, None
                        self.condition.notify_all()
                    # Bounded wait also responds to existing callers setting stop.
                    self.wake.wait(.25)
                    self.wake.clear()
                    continue
                with self.lock:
                    self.paused = False
                if cap is not None and quality != mode:
                    cap.release()
                    cap = None
                mode = quality
                try:
                    if self.demo:
                        frame = np.full((480, 800, 3), 237, np.uint8)
                        cv2.rectangle(frame, (140, 60), (660, 420), (36, 40, 44), 12)
                        cv2.putText(frame, 'OpenPaper 7', (210, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (30, 40, 30), 3)
                        cv2.putText(frame, 'DEMO - no camera', (205, 270), cv2.FONT_HERSHEY_SIMPLEX, .8, (50, 50, 170), 2)
                        ok = True
                    else:
                        if cap is None:
                            cap = self.open_capture(quality)
                        ok, frame = cap.read()
                    error = None if ok else f'Keine Bilder von {self.device}; USB-Verbindung prüfen'
                except Exception as exc:
                    ok, frame, error = False, None, str(getattr(exc, 'detail', exc))
                with self.condition:
                    if ok:
                        if self.requested_resolution and (frame.shape[1], frame.shape[0]) != tuple(self.requested_resolution):
                            self.quality_note = 'Kamera liefert eine andere Auflösung als angefordert'
                        self.frame, self.updated, self.error = frame, time.monotonic(), None
                        self.frame_quality = quality
                        self.sequence += 1
                    else:
                        self.frame, self.error, self.frame_quality = None, error, None
                    self.condition.notify_all()
                if not ok:
                    if cap is not None:
                        cap.release()
                    cap = None
                    self.stop.wait(2)
                else:
                    # Drivers may ignore FPS requests; also cap host processing.
                    self.stop.wait(max(0, 1 / self.fps - (time.monotonic() - started)))
        finally:
            if cap is not None:
                cap.release()
            with self.condition:
                self.condition.notify_all()

    def open_capture(self, quality):
        if self.device.startswith('supercamera:'):
            return SupercameraCapture(self.device)
        if self.native_resolution is None:
            fallback = (int(os.getenv('CAMERA_WIDTH', '1920')), int(os.getenv('CAMERA_HEIGHT', '1080')))
            limit = (int(os.getenv('CAMERA_PREVIEW_WIDTH', '1280')), int(os.getenv('CAMERA_PREVIEW_HEIGHT', '720')))
            self.native_resolution, self.preview_resolution, self.quality_note = capture_sizes(self.device, fallback, limit)
        cap = cv2.VideoCapture(self.device, cv2.CAP_V4L2)
        try:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
            self.requested_resolution = self.native_resolution if quality == 'high' else self.preview_resolution
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.requested_resolution[0])
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.requested_resolution[1])
            accepted = cap.set(cv2.CAP_PROP_FPS, self.fps)
            reported = cap.get(cv2.CAP_PROP_FPS)
            self.reported_fps = reported if math.isfinite(reported) and reported > 0 else None
            self.fps_note = None if accepted and self.reported_fps is not None and abs(self.reported_fps - self.fps) < .1 else 'Treiber bestätigt die gewünschte Bildrate nicht; USB-Bildrate kann höher sein'
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            try:
                self.controls.initialize()
            except Exception as exc:
                self.controls.error = str(getattr(exc, 'detail', exc))
            return cap
        except Exception:
            cap.release()
            raise

    def frame_for(self, quality='high', after=None, timeout=8):
        with self.condition:
            if self.stop.is_set():
                raise HTTPException(503, 'Kamera nicht verfügbar')
            now = time.monotonic()
            self.demand_until = now + max(self.idle_seconds, timeout + 1)
            if quality == 'high':
                self.high_until = self.demand_until
            self.wake.set()
            def ready():
                return (self.frame is not None and time.monotonic() - self.updated <= 4
                        and (quality != 'high' or self.frame_quality == 'high')
                        and (after is None or self.sequence > after))
            if not self.condition.wait_for(lambda: ready() or self.stop.is_set(), timeout) or self.stop.is_set():
                raise HTTPException(503, self.error or 'Keine frischen Kamerabilder verfügbar')
            return self.frame, self.sequence

    def snapshot(self, raw=False, quality='high'):
        frame, _ = self.frame_for(quality)
        image = frame.copy()
        return image if raw else self.gray.apply(image)

    def next_frame(self, after, timeout=2):
        frame, sequence = self.frame_for('high', after, timeout)
        return frame.copy(), sequence

    def preview_jpeg(self, encode, quality='standard', rotation=0, corners=None):
        # One renderer per camera, so simultaneous viewers reuse the same bytes.
        with self.render_lock:
            frame, sequence = self.frame_for(quality)
            key = (quality, rotation, tuple((p.x, p.y) for p in corners) if corners else None,
                   json.dumps(self.gray.status(), sort_keys=True))
            if self.render_sequence != sequence:
                self.render_cache.clear()
                self.render_sequence = sequence
            if key not in self.render_cache:
                image = orient(self.gray.apply(frame), rotation)
                if corners:
                    image = rectify(image, corners)
                data = encode(preview_image(image, quality), 98 if quality == 'high' else 88)
                if len(self.render_cache) >= 8:
                    self.render_cache.clear()
                self.render_cache[key] = data
            return self.render_cache[key]

    def status(self):
        # Status polling must not wake a camera or renew its capture lease.
        with self.lock:
            age = round(time.monotonic() - self.updated, 2) if self.updated else None
            return {'connected': self.frame is not None and age < 4, 'device': self.device,
                    'paused': self.paused, 'frame_age_seconds': age, 'error': self.error,
                    'native_resolution': self.native_resolution, 'quality_note': self.quality_note,
                    'requested_fps': self.fps, 'reported_fps': self.reported_fps, 'fps_note': self.fps_note,
                    'capture_quality': self.frame_quality,
                    'resolution': [self.frame.shape[1], self.frame.shape[0]] if self.frame is not None else None}
