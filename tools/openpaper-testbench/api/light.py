"""PL81 PRO USB CCT control with persistent modes and browser leases.

Protocol: https://github.com/m-rk/neewer-usb-control (RESEARCH.md).
No generic CH340 probing: the user must assign the lamp's stable USB path.
"""
import json
from dataclasses import dataclass
import threading
import time
from fastapi import HTTPException
from hardware import find_port, open_port
from rig import atomic_json


def cct_packet(brightness, kelvin):
    step = round((kelvin - 2900) * 18 / 4100)
    payload = bytes([0x3a, 0x02, 0x03, 0x01, brightness, step])
    return payload + sum(payload).to_bytes(2, 'big')


@dataclass
class CommandState:
    requested: tuple | None = None
    acknowledged: tuple | None = None
    failures: int = 0
    retry_at: float = 0
    refresh_at: float = 0
    error: str | None = None


class Light:
    TTL = 15
    REFRESH_SECONDS = 60
    RETRY_SECONDS = (1, 2, 5, 10, 30)

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
        self.commands = {}
        self.pending_off = set()

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

    def apply(self, device, brightness, kelvin, force=False):
        """Rate-limit each USB device independently; only ACKs confirm state."""
        state = self.commands.setdefault(device, CommandState())
        target = (brightness, kelvin)
        # An off transition gets one immediate attempt, even during backoff.
        off_transition = brightness == 0 and state.requested is not None and state.requested[0] != 0
        state.requested = target
        now = self.clock()
        if not (force or off_transition):
            if now < state.retry_at:
                return state
            if state.acknowledged == target and now < state.refresh_at:
                return state
        try:
            self.send(device, *target)
        except Exception as exc:
            delay = self.RETRY_SECONDS[min(state.failures, len(self.RETRY_SECONDS)-1)]
            state.failures = min(state.failures + 1, len(self.RETRY_SECONDS))
            state.retry_at = self.clock() + delay
            state.acknowledged = None
            state.error = str(getattr(exc, 'detail', exc))
        else:
            state.acknowledged = target
            state.failures, state.retry_at, state.error = 0, 0, None
            # Reassert occasionally so a power-cycled lamp recovers at the same path.
            state.refresh_at = self.clock() + self.REFRESH_SECONDS
        return state

    def tick(self, force_off=False):
        with self.lock:
            device = self.device()
            active = self.active()
            mode = self.settings['mode']
            brightness = 100 if not force_off and (mode == 'on' or (mode == 'auto' and active)) else 0
            kelvin = self.settings['kelvin']
            if self.last_device and self.last_device != device:
                self.pending_off.add(self.last_device)
            self.last_device = device
            self.pending_off.discard(device)
            errors = []
            for old_device in tuple(self.pending_off):
                state = self.apply(old_device, 0, kelvin, force=force_off)
                if state.acknowledged == (0, kelvin):
                    self.pending_off.remove(old_device)
                    del self.commands[old_device]
                elif state.error:
                    errors.append(f'{old_device}: {state.error}')
            self.commanded_brightness, self.confirmed = None, False
            if device:
                state = self.apply(device, brightness, kelvin, force=force_off)
                self.confirmed = state.acknowledged == (brightness, kelvin)
                if self.confirmed:
                    self.commanded_brightness = brightness
                if state.error:
                    errors.append(state.error)
            self.error = '; '.join(errors) or None

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
