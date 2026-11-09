"""USB failure/recovery regressions with a deterministic clock."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
from light import Light, cct_packet
import light as module
import pytest


@pytest.fixture
def lamp(tmp_path):
    now, device, sent = [0], ['lamp'], []
    light = Light(tmp_path / 'light.json', lambda: device[0], clock=lambda: now[0])
    light.send = lambda *args: sent.append(args)
    return light, now, device, sent


def test_unchanged_off_is_quiet_but_periodically_reasserted(lamp):
    light, now, _, sent = lamp
    for second in range(60):
        now[0] = second
        light.tick()
    assert sent == [('lamp', 0, 7000)]
    now[0] = 60
    light.tick()
    assert sent == [('lamp', 0, 7000)] * 2


def test_settings_changes_and_expired_lease_send_without_waiting_for_refresh(lamp):
    light, now, _, sent = lamp
    light.heartbeat('browser', True)
    light.tick()
    light.configure({'mode': 'auto', 'kelvin': 4950})
    light.tick()
    now[0] = 15
    light.tick()
    assert sent == [('lamp', 100, 7000), ('lamp', 100, 4950), ('lamp', 0, 4950)]


def test_usb_errors_back_off_recover_and_reset_delay(lamp):
    light, now, _, sent = lamp
    attempts = []
    def fail(*args):
        attempts.append(now[0])
        raise OSError('USB disconnected')
    light.send = fail
    for second in range(80):
        now[0] = second
        light.tick()
        assert not light.status()['confirmed']
        assert light.status()['commanded_brightness'] is None
    assert attempts == [0, 1, 3, 8, 18, 48, 78]
    light.send = lambda *args: sent.append(args)
    now[0] = 107
    light.tick()
    assert not sent
    now[0] = 108
    light.tick()
    assert light.status()['confirmed'] and light.status()['error'] is None
    light.send = fail
    now[0] = 168
    light.tick()
    now[0] = 169
    light.tick()
    assert attempts[-2:] == [168, 169]


def test_off_transition_and_shutdown_bypass_backoff_once(lamp):
    light, now, _, sent = lamp
    light.configure({'mode': 'on', 'kelvin': 7000})
    def fail(*args):
        sent.append(args)
        raise OSError('USB disconnected')
    light.send = fail
    for second in range(19):
        now[0] = second
        light.tick()
    assert len(sent) == 5
    light.configure({'mode': 'off', 'kelvin': 7000})
    light.tick()
    assert sent[-1] == ('lamp', 0, 7000) and len(sent) == 6
    light.tick()
    assert len(sent) == 6
    light.close()
    assert sent[-1] == ('lamp', 0, 7000) and len(sent) == 7


def test_missing_old_lamp_does_not_block_new_lamp_and_retries_off(lamp):
    light, now, device, sent = lamp
    light.configure({'mode': 'on', 'kelvin': 7000})
    light.tick()
    missing = [True]
    def send(*args):
        sent.append(args)
        if args[0] == 'lamp' and missing[0]:
            raise OSError('old lamp missing')
    light.send = send
    device[0] = 'new'
    light.tick()
    assert sent[-2:] == [('lamp', 0, 7000), ('new', 100, 7000)]
    assert light.status()['confirmed']
    assert 'old lamp missing' in light.status()['error']
    light.tick()
    assert len(sent) == 3
    missing[0] = False
    now[0] = 1
    light.tick()
    assert sent[-1] == ('lamp', 0, 7000)
    assert light.status()['error'] is None
    now[0] = 2
    light.tick()
    assert len(sent) == 4
    device[0] = None
    light.tick()
    assert sent[-1] == ('new', 0, 7000)
    assert not light.status()['confirmed']
    light.tick()
    assert len(sent) == 5


def test_switch_back_cancels_pending_off(lamp):
    light, now, device, sent = lamp
    light.configure({'mode': 'on', 'kelvin': 7000})
    light.tick()
    def fail(*args):
        raise OSError('hub missing')
    light.send = fail
    device[0] = 'new'
    light.tick()
    device[0] = 'lamp'
    now[0] = 1
    light.send = lambda *args: sent.append(args)
    light.tick()
    assert sent[-2:] == [('new', 0, 7000), ('lamp', 100, 7000)]
    assert light.status()['confirmed'] and light.status()['error'] is None


@pytest.mark.parametrize('acknowledged', [True, False])
def test_real_send_requires_ack_and_closes_port(lamp, monkeypatch, acknowledged):
    light, _, _, _ = lamp
    closed = []
    class Port:
        def reset_input_buffer(self): pass
        def write(self, packet): return len(packet)
        def read(self, size): return cct_packet(0, 7000) if acknowledged else b''
        def close(self): closed.append(True)
    monkeypatch.setattr(module, 'find_port', lambda *args: '/dev/fake')
    monkeypatch.setattr(module, 'open_port', lambda *args: Port())
    times = iter([0, 0, 2])
    monkeypatch.setattr(module.time, 'monotonic', lambda: next(times))
    light.send = Light.send.__get__(light)
    light.tick()
    assert light.status()['confirmed'] is acknowledged
    assert closed == [True]
