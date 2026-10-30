"""Separate LCUS-1 relay commands and read-only CP210x UART capture."""
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
import os
import threading
import time
import uuid

import serial
from serial.tools import list_ports
from fastapi import HTTPException


def now():
    return datetime.now(timezone.utc).isoformat()


def find_port(kind):
    """Never select an arbitrary tty: relay and UART must remain distinct."""
    configured = os.getenv('RELAY_DEVICE' if kind == 'relay' else 'SERIAL_DEVICE', '')
    vid, pid = (0x1a86, 0x7523) if kind == 'relay' else (0x10c4, 0xea60)
    try:
        matches = [p.device for p in list_ports.comports() if (p.vid, p.pid) == (vid, pid)]
    except (OSError, TypeError, ValueError) as exc:
        # pyserial can see a tty before its USB sysfs attributes exist (or after removal).
        raise OSError(f'{kind}: USB-Port ändert sich gerade; erneuter Versuch') from exc
    if configured:
        if os.path.realpath(configured) not in [os.path.realpath(p) for p in matches]:
            raise OSError(f'{kind}: konfigurierter USB-Port fehlt oder hat den falschen Gerätetyp')
        return configured
    if len(matches) != 1:
        raise OSError(f'{kind}: kein eindeutiger USB-Port ({len(matches)} gefunden)')
    return matches[0]


def open_port(device, baud):
    # Set control lines before opening; UART is never used to reset/flash the frame.
    port = serial.Serial(port=None, baudrate=baud, timeout=.25, write_timeout=1, exclusive=True)
    port.dtr = False
    port.rts = False
    port.port = device
    port.open()
    return port


class Relay:
    def __init__(self):
        self.enabled = os.getenv('RELAY_ENABLED', '0') == '1'
        self.lock = threading.Lock()
        self.commanded_power = None
        self.last_command = None
        self.error = None
        self.completed = 0
        self.total = 0
        self.device = None

    def status(self):
        try:
            device = find_port('relay') if self.enabled else None
            available = bool(device)
            error = self.error
        except OSError as exc:
            device, available, error = None, False, str(exc)
            self.commanded_power = None
        return {'enabled': self.enabled, 'available': available, 'device': device,
                'baudrate': 9600, 'wiring': 'NC', 'busy': self.lock.locked(),
                'commanded_power': self.commanded_power, 'feedback_available': False,
                'last_command': self.last_command, 'error': error,
                'completed': self.completed, 'total': self.total}

    def write(self, port, on):
        command = bytes.fromhex('a0 01 00 a1' if on else 'a0 01 01 a2')
        if port.write(command) != len(command):
            raise OSError('Relais-Befehl unvollständig übertragen')
        self.commanded_power = on
        self.last_command = now()

    @contextmanager
    def connection(self):
        if not self.enabled:
            raise HTTPException(503, 'Relais deaktiviert')
        if not self.lock.acquire(blocking=False):
            raise HTTPException(409, 'Relais ist beschäftigt')
        port = None
        try:
            self.device = find_port('relay')
            port = open_port(self.device, 9600)
            self.error = None
            yield port
        except (OSError, serial.SerialException) as exc:
            self.commanded_power = None
            self.error = str(exc)
            raise HTTPException(503, f'Relais: {exc}') from exc
        finally:
            try:
                if port:
                    port.close()
            finally:
                self.lock.release()

    def power(self, on):
        with self.connection() as port:
            self.total = self.completed = 0
            self.write(port, on)
            time.sleep(.15)  # LCUS-1 command processing before closing the port.
        return self.status()

    def reset(self, count):
        with self.connection() as port:
            self.total, self.completed = count, 0
            try:
                for index in range(count):
                    self.write(port, False)
                    time.sleep(.25)  # Short reset pulse; keep UART open to verify the reboot.
                    self.write(port, True)
                    self.completed += 1
                    if index + 1 < count:
                        time.sleep(1.5)  # Powered pause between the end and start of reset pulses.
            finally:
                # Best effort to leave the frame powered, even if the sequence fails.
                self.write(port, True)
                time.sleep(.15)
        return {**self.status(), 'cycles': count, 'off_ms': 250, 'interval_ms': 1500,
                'note': 'Stromzyklen gesendet; kein bestätigter Factory-Reset.'}


class SerialMonitor:
    def __init__(self):
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.worker = None
        self.lines = deque(maxlen=2000)
        self.session = uuid.uuid4().hex
        self.sequence = 0
        self.connected = False
        self.device = None
        self.error = 'Warte auf USB-UART (CP210x)'
        self.last_received = None
        self.baud = int(os.getenv('SERIAL_BAUDRATE', '115200'))
        self.partial = b''

    def append(self, raw):
        # Bounded lines and plain text only, including malformed UTF-8 from boot.
        text = raw.decode('utf-8', errors='replace').rstrip('\r')
        text = ''.join(c for c in text if c == '\t' or ord(c) >= 32)
        with self.lock:
            self.sequence += 1
            self.lines.append({'id': self.sequence, 'at': now(), 'text': text})

    def feed(self, data):
        self.partial += data
        while b'\n' in self.partial:
            line, self.partial = self.partial.split(b'\n', 1)
            while len(line) > 2048:
                self.append(line[:2048]); line = line[2048:]
            self.append(line)
        while len(self.partial) >= 2048:
            self.append(self.partial[:2048]); self.partial = self.partial[2048:]

    def status(self):
        return {'connected': self.connected, 'device': self.device, 'baudrate': self.baud,
                'error': self.error, 'last_received': self.last_received, 'read_only': True,
                'session': self.session, 'retained_lines': len(self.lines), 'capacity': 2000}

    def read(self, after=0, limit=200):
        with self.lock:
            lines = [line for line in self.lines if line['id'] > after][:limit]
            oldest = self.lines[0]['id'] if self.lines else self.sequence + 1
            return {'session': self.session, 'lines': lines,
                    'next_cursor': lines[-1]['id'] if lines else max(after, self.sequence),
                    'truncated': after > 0 and after < oldest - 1,
                    'status': self.status()}

    def run(self):
        while not self.stop.is_set():
            port = None
            try:
                self.device = find_port('serial')
                port = open_port(self.device, self.baud)
                self.connected, self.error = True, None
                while not self.stop.is_set():
                    data = port.read(1024)
                    if data:
                        self.last_received = now()
                        self.feed(data)
                    elif self.partial:
                        self.append(self.partial); self.partial = b''
            except (OSError, serial.SerialException) as exc:
                self.error = str(exc)
            finally:
                self.connected = False
                if port:
                    try:
                        port.close()
                    except (OSError, serial.SerialException):
                        pass  # A disappearing device must not terminate the reconnect loop.
                if self.partial:
                    self.append(self.partial); self.partial = b''
            self.stop.wait(.2)

    def start(self):
        self.stop.clear()
        self.worker = threading.Thread(target=self.run, daemon=True)
        self.worker.start()

    def close(self):
        self.stop.set()
        if self.worker:
            self.worker.join(3)
