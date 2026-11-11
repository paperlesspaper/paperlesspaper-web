import os
from pathlib import Path
import sys
import threading
import time
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import hardware as h
import pytest


@pytest.fixture
def relay(monkeypatch):
    monkeypatch.setenv('RELAY_ENABLED', '1')
    r = h.Relay()
    calls = []
    port = SimpleNamespace(write=lambda data: calls.append(data) or len(data), close=lambda: None)
    monkeypatch.setattr(h, 'find_port', lambda kind: '/dev/fake')
    monkeypatch.setattr(h, 'open_port', lambda device, baud: port)
    monkeypatch.setattr(h.time, 'sleep', lambda seconds: calls.append(seconds))
    return r, calls, port


def test_relay_nc_commands_and_exact_six_cycles(relay):
    r, calls, _ = relay
    r.power(True)
    assert calls[0] == bytes.fromhex('a0 01 00 a1')
    calls.clear()
    result = r.reset(6)
    off, on = bytes.fromhex('a0 01 01 a2'), bytes.fromhex('a0 01 00 a1')
    assert calls == [off, .25, on, 1.5] * 5 + [off, .25, on, on, .15]
    assert result['completed'] == 6 and result['commanded_power'] is True
    assert result['off_ms'] == 250 and result['interval_ms'] == 1500
    assert result['feedback_available'] is False


def test_relay_failure_attempts_restore_and_releases_lock(relay):
    r, calls, port = relay
    def fail(data):
        calls.append(data)
        raise OSError('unplugged')
    port.write = fail
    with pytest.raises(h.HTTPException) as exc:
        r.reset(6)
    assert exc.value.status_code == 503
    assert calls == [bytes.fromhex('a0 01 01 a2'), bytes.fromhex('a0 01 00 a1')]
    assert r.commanded_power is None and not r.lock.locked()


def test_relay_busy_never_writes(relay):
    r, calls, _ = relay
    with r.lock:
        with pytest.raises(h.HTTPException) as exc:
            r.power(False)
        assert exc.value.status_code == 409
    assert calls == []


def test_usb_roles_and_ambiguity(monkeypatch):
    monkeypatch.delenv('RELAY_DEVICE', raising=False)
    monkeypatch.delenv('SERIAL_DEVICE', raising=False)
    ports = [SimpleNamespace(device='/dev/ttyUSB1', vid=0x1a86, pid=0x7523),
             SimpleNamespace(device='/dev/ttyUSB0', vid=0x10c4, pid=0xea60)]
    monkeypatch.setattr(h.list_ports, 'comports', lambda: ports)
    assert h.find_port('relay') == '/dev/ttyUSB1'
    assert h.find_port('serial') == '/dev/ttyUSB0'
    ports.append(SimpleNamespace(device='/dev/ttyUSB2', vid=0x1a86, pid=0x7523))
    with pytest.raises(OSError): h.find_port('relay')
    monkeypatch.setenv('RELAY_DEVICE', '/dev/ttyUSB0')
    with pytest.raises(OSError): h.find_port('relay')


def test_serial_fragmented_utf8_limits_and_cursors():
    monitor = h.SerialMonitor()
    data = 'Grüße\r\n<script>hello</script>\n'.encode()
    monitor.feed(data[:3]); monitor.feed(data[3:])
    assert [l['text'] for l in monitor.read()['lines']] == ['Grüße', '<script>hello</script>']
    monitor.feed(b'x' * 5000)
    assert len(monitor.partial) < 2048
    for index in range(2200): monitor.append(str(index).encode())
    result = monitor.read(1, 10)
    assert result['truncated'] and len(result['lines']) == 10
    assert len(monitor.lines) == 2000
    assert monitor.read(result['next_cursor'], 1)['lines'][0]['id'] == result['next_cursor'] + 1


def test_serial_reads_pty_and_reconnects_without_writing(monkeypatch):
    # Real pyserial through a pseudo-terminal: exercises timeout, read and close.
    import pty
    master, slave = pty.openpty()
    monkeypatch.setattr(h, 'find_port', lambda kind: os.ttyname(slave))
    monitor = h.SerialMonitor()
    try:
        monitor.start()
        deadline = time.monotonic() + 3
        while not monitor.connected and time.monotonic() < deadline: time.sleep(.01)
        assert monitor.connected
        os.write(master, b'[MAIN] INIT Device V: test\r\n')
        deadline = time.monotonic() + 3
        while not monitor.sequence and time.monotonic() < deadline: time.sleep(.01)
        assert monitor.read()['lines'][0]['text'] == '[MAIN] INIT Device V: test'
        os.close(master); master = None
        deadline = time.monotonic() + 3
        while monitor.connected and time.monotonic() < deadline: time.sleep(.01)
        assert not monitor.connected
    finally:
        monitor.close()
        if master is not None: os.close(master)
        os.close(slave)
    assert not monitor.worker.is_alive()


@pytest.mark.parametrize('failure', [TypeError('missing idVendor'), ValueError('partial USB id')])
def test_serial_recovers_from_usb_enumeration_race(monkeypatch, failure):
    attempts = []
    monitor = h.SerialMonitor()
    def ports():
        attempts.append(True)
        if len(attempts) == 1:
            raise failure
        return [SimpleNamespace(device='/dev/fake', vid=0x10c4, pid=0xea60)]
    class Port:
        def read(self, size):
            monitor.stop.set()
            return b'[MAIN] INIT Device V: recovered\n'
        def close(self):
            raise OSError('device removed while closing')
    monkeypatch.setattr(h.list_ports, 'comports', ports)
    monkeypatch.setattr(h, 'open_port', lambda device, baud: Port())
    monitor.start()
    monitor.worker.join(3)
    assert not monitor.worker.is_alive()
    assert len(attempts) == 2
    assert monitor.read()['lines'][0]['text'] == '[MAIN] INIT Device V: recovered'
    assert monitor.error is None
