"""Bounded userspace UseeePlus capture for non-UVC Geek szitman endoscopes.

Protocol adapted from hbens/geek-szitman-supercamera, CC0-1.0:
https://github.com/hbens/geek-szitman-supercamera/blob/master/supercamera_poc.cpp
"""
from pathlib import Path
import time
import cv2
import numpy as np

USB_IDS = {(0x0329,0x2022),(0x2ce3,0x3828)}


def discover(root=Path('/sys/bus/usb/devices')):
    devices = []
    for path in sorted(root.glob('*')):
        try:
            ids = (int((path/'idVendor').read_text(),16),int((path/'idProduct').read_text(),16))
            if ids in USB_IDS:
                devices.append({'id':'supercamera:'+path.name,'name':'Geek szitman · Endoskop',
                                'device':path.name,'driver':'useeplus'})
        except (OSError,ValueError):
            continue
    return devices


class FrameAssembler:
    LIMIT = 2 * 1024 * 1024

    def __init__(self):
        self.buffer = bytearray()
        self.identity = None

    def feed(self, packet):
        if len(packet)<12 or packet[:2]!=b'\xaa\xbb' or packet[2] not in (7,11):
            self.buffer.clear(); self.identity=None
            return None
        length = int.from_bytes(packet[3:5],'little')
        if length<7 or 5+length>len(packet):
            self.buffer.clear();self.identity=None
            return None
        # Flags: bit 1 is the physical photo button, not part of frame identity.
        fid, camera, flags = packet[5],packet[6],packet[7]&~2
        if camera>1 or flags:
            self.buffer.clear();self.identity=None
            return None
        identity=(fid,camera)
        completed=None
        if self.identity!=identity:
            if self.buffer.startswith(b'\xff\xd8') and self.buffer.endswith(b'\xff\xd9'):
                completed=bytes(self.buffer)
            self.buffer.clear();self.identity=identity
        self.buffer.extend(packet[12:5+length])  # Ignore retransmitted tail on 0329:2022.
        if len(self.buffer)>self.LIMIT:
            self.buffer.clear();self.identity=None
        return completed


class SupercameraCapture:
    def __init__(self, identity):
        import usb.core
        import usb.util
        self.usb, self.util = usb.core, usb.util
        self.device=None
        self.claimed=[]
        self.assembler=FrameAssembler()
        location=identity.removeprefix('supercamera:')
        if not location or '/' in location or '..' in location:
            raise OSError('Ungültiger Endoskop-Anschluss')
        path=Path('/sys/bus/usb/devices')/location
        ids=(int((path/'idVendor').read_text(),16),int((path/'idProduct').read_text(),16))
        if ids not in USB_IDS: raise OSError('Am gespeicherten Anschluss ist keine Supercamera')
        bus,address=int((path/'busnum').read_text()),int((path/'devnum').read_text())
        self.device=usb.core.find(idVendor=ids[0],idProduct=ids[1],bus=bus,address=address)
        if self.device is None: raise OSError('Endoskop nicht verbunden')
        try:
            for interface in (0,1):
                usb.util.claim_interface(self.device,interface)
                self.claimed.append(interface)
            self.device.set_interface_altsetting(interface=1,alternate_setting=1)
            self.device.clear_halt(0x01)
            self.device.write(0x02,bytes.fromhex('ff 55 ff 55 ee 10'),timeout=1000)
            self.device.write(0x01,bytes.fromhex('bb aa 05 00 00'),timeout=1000)
        except Exception:
            self.release()
            raise

    def read(self):
        deadline=time.monotonic()+3
        while time.monotonic()<deadline:
            try:
                packet=bytes(self.device.read(0x81,1024,timeout=500))
            except self.usb.USBTimeoutError:
                continue
            data=self.assembler.feed(packet)
            if data:
                frame=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR)
                if frame is not None: return True,frame
        return False,None

    def release(self):
        if self.device is not None:
            for interface in reversed(self.claimed):
                try: self.util.release_interface(self.device,interface)
                except self.usb.USBError: pass
            self.util.dispose_resources(self.device)
            self.device=None;self.claimed=[]
