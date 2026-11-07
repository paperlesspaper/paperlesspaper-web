"""PL81 PRO USB CCT control with persistent modes and browser leases.

Protocol: https://github.com/m-rk/neewer-usb-control (RESEARCH.md).
No generic CH340 probing: the user must assign the lamp's stable USB path.
"""
import json
import threading
import time
from fastapi import HTTPException
from hardware import find_port, open_port
from rig import atomic_json


def cct_packet(brightness, kelvin):
    step = round((kelvin - 2900) * 18 / 4100)
    payload = bytes([0x3a, 0x02, 0x03, 0x01, brightness, step])
    return payload + sum(payload).to_bytes(2, 'big')


class Light:
    TTL = 15

    def __init__(self, path, device, valid_session=lambda s: True, demo=False, clock=time.monotonic):
        self.path, self.device, self.valid_session, self.demo, self.clock = path, device, valid_session, demo, clock
        self.lock = threading.RLock()
        self.stop = threading.Event()
        self.worker = None
        self.leases = {}
        self.settings = {'enabled':True,'brightness':100,'kelvin':7000}
        if path.exists(): self.settings.update(json.loads(path.read_text()))
        self.settings = self.normalize(self.settings)
        self.commanded_brightness, self.confirmed, self.error = None, False, None
        self.last_device = None

    @staticmethod
    def normalize(settings):
        # Preserve the previous enabled checkbox for saved files and older clients.
        mode = settings.get('mode') or ('auto' if settings.get('enabled', True) else 'off')
        if mode not in ('auto', 'on', 'off'):
            raise HTTPException(422, 'Ungültiger Lichtmodus')
        return {**settings, 'mode':mode, 'enabled':mode != 'off', 'brightness':100}

    def active(self):
        now = self.clock()
        self.leases = {k:v for k,v in self.leases.items() if v[0] > now and (not v[1] or self.valid_session(v[1]))}
        return bool(self.leases)

    def heartbeat(self, client, visible, session=None):
        with self.lock:
            if visible:
                if client not in self.leases and len(self.leases) >= 64:
                    raise HTTPException(429, 'Zu viele aktive Browser')
                self.leases[client] = (self.clock()+self.TTL,session)
            else:
                self.leases.pop(client,None)
            return self.status()

    def status(self):
        with self.lock:
            active = self.active()
            return {**self.settings, 'device':self.device(), 'active_browser':active,
                    'lease_seconds':self.TTL,'commanded_brightness':self.commanded_brightness,
                    'confirmed':self.confirmed,'error':self.error,
                    'effective_kelvin':round(2900+round((self.settings['kelvin']-2900)*18/4100)*4100/18)}

    def configure(self, settings):
        with self.lock:
            settings = self.normalize(settings)
            atomic_json(self.path, settings)
            self.settings = settings
            return self.status()

    def send(self, device, brightness, kelvin):
        if self.demo: return
        port = open_port(find_port('relay',device),115200)
        try:
            packet = cct_packet(brightness,kelvin)
            port.reset_input_buffer()
            if port.write(packet) != len(packet): raise OSError('Lichtbefehl unvollständig')
            received = b''
            deadline = time.monotonic()+1
            while time.monotonic() < deadline:
                received = (received + port.read(64))[-256:]
                if packet in received: return
            raise OSError('Keine bestätigte Antwort vom PL81 PRO')
        finally:
            port.close()

    def tick(self, force_off=False):
        with self.lock:
            device = self.device()
            active = self.active()
            mode = self.settings['mode']
            brightness = 100 if not force_off and (mode == 'on' or (mode == 'auto' and active)) else 0
            try:
                if self.last_device and self.last_device != device:
                    self.send(self.last_device,0,self.settings['kelvin'])
                    self.last_device = None
                if not device:
                    self.commanded_brightness, self.confirmed = None,False
                    return
                self.last_device = device
                self.send(device,brightness,self.settings['kelvin'])
                self.commanded_brightness, self.confirmed, self.error = brightness,True,None
            except Exception as exc:
                self.commanded_brightness, self.confirmed = None,False
                self.error = str(getattr(exc,'detail',exc))

    def run(self):
        while not self.stop.is_set():
            self.tick()
            self.stop.wait(1)

    def start(self):
        self.stop.clear()
        self.worker = threading.Thread(target=self.run,daemon=True)
        self.worker.start()

    def close(self):
        self.stop.set()
        if self.worker: self.worker.join(4)
        with self.lock:
            self.leases.clear()
            self.tick(force_off=True)
