import importlib.util
import os
from pathlib import Path
import tempfile
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / "api"))
import threading
import time

os.environ['DATA_DIR'] = tempfile.mkdtemp(prefix='openpaper-test-')
os.environ['DEMO_MODE'] = '1'
os.environ['BUTTON_ENABLED'] = '1'
os.environ['API_TOKEN'] = 'test-secret'
from auth import hash_password
os.environ['WEB_PASSWORD_HASH'] = hash_password('test-password')
spec = importlib.util.spec_from_file_location('testbench', Path(__file__).parents[1] / 'api' / 'app.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
from fastapi.testclient import TestClient
import numpy as np
import pytest

HEADERS = {'Authorization': 'Bearer test-secret'}

@pytest.fixture
def client():
    m.button.last_mono = 0
    m.web_auth.sessions.clear()
    m.web_auth.attempts.clear()
    with TestClient(m.app, headers=HEADERS) as client:
        for _ in range(100):
            if m.camera.frame is not None:
                break
            time.sleep(.01)
        yield client
    m.camera.stop.clear()


def test_remote_camera_requires_auth(client):
    client.headers.pop('authorization')
    assert client.get('/api/camera.jpg').status_code == 401
    assert client.get('/api/status').status_code == 401
    assert client.get('/healthz').status_code == 401
    assert client.post('/api/login', json={'password':'bad'}, headers={'X-Testbench':'1'}).status_code == 401
    response = client.post('/api/login', json={'password':'test-password'}, headers={'X-Testbench':'1'})
    assert response.status_code == 200
    assert 'HttpOnly' in response.headers['set-cookie']
    assert client.get('/api/status').status_code == 200


def test_csrf_blocked_even_with_cookie_or_loopback(client):
    assert client.post('/api/photos', json={}, headers={'Origin':'https://attacker.test'}).status_code == 403
    client.headers.pop('authorization')
    assert client.post('/api/button/press', json={}).status_code == 403


def test_photo_reference_compare_and_retention(client):
    assert client.get('/api/camera.jpg').headers['content-type'] == 'image/jpeg'
    assert client.post('/api/reference', json={'region':{'x':.2,'y':.1,'width':.6,'height':.8}}).status_code == 200
    result = client.post('/api/analyze', json={}).json()
    assert result['matches_reference'] and result['mean_difference'] == 0
    photo = client.post('/api/photos', json={})
    assert photo.status_code == 201
    assert client.get(photo.json()['url']).content.startswith(b'\xff\xd8')
    old_limit = m.MAX_PHOTOS
    m.MAX_PHOTOS = 2
    try:
        for _ in range(4):
            assert client.post('/api/photos', json={}).status_code == 201
        assert len(client.get('/api/photos').json()) == 2
    finally:
        m.MAX_PHOTOS = old_limit


def test_stale_camera_cannot_capture_or_pass_analysis(client):
    m.camera.stop.set()
    time.sleep(.3)
    m.camera.updated = time.monotonic() - 10
    assert client.get('/api/camera.jpg').status_code == 503
    assert client.post('/api/photos', json={}).status_code == 503
    assert client.post('/api/analyze', json={}).status_code == 503
    assert not client.get('/api/status').json()['camera']['connected']


def test_input_limits(client):
    for value in (0, 49, 3001):
        assert client.post('/api/button/press', json={'duration_ms':value}).status_code == 422
    assert client.post('/api/reference', json={'region':{'x':.9,'width':.5}}).status_code == 422
    assert client.post('/api/reference', json={'region':{'width':.001}}).status_code == 422
    assert client.post('/api/analyze', json={'max_difference':2}).status_code == 422


def test_disabled_busy_and_rate_limited_button(client):
    m.button.enabled = False
    assert client.post('/api/button/press', json={}).status_code == 503
    m.button.enabled = True
    m.button.lock.acquire()
    try:
        assert client.post('/api/button/press', json={}).status_code == 409
    finally:
        m.button.lock.release()
    assert client.post('/api/button/press', json={'duration_ms':50}).status_code == 200
    assert client.post('/api/button/press', json={'duration_ms':50}).status_code == 429
    assert not m.button.pressed


def test_real_output_always_released_after_failure(monkeypatch):
    class FakeValue:
        ACTIVE = 'active'
        INACTIVE = 'inactive'
    class FailingLine:
        def __init__(self): self.calls=[]
        def set_value(self, pin, value):
            self.calls.append(value)
            if value == FakeValue.ACTIVE: raise RuntimeError('output failed')
    import sys, types
    monkeypatch.setitem(sys.modules, 'gpiod', types.ModuleType('gpiod'))
    fake = types.ModuleType('gpiod.line'); fake.Value = FakeValue
    monkeypatch.setitem(sys.modules, 'gpiod.line', fake)
    b = m.Button(); b.line = FailingLine()
    with pytest.raises(RuntimeError): b.press(50)
    assert b.line.calls == ['active','inactive']
    assert not b.pressed
    assert b.lock.acquire(blocking=False)
    b.lock.release()


def test_comparison_detects_changed_display():
    black = np.zeros((100,100,3),np.uint8)
    white = np.full_like(black,255)
    result = m.compare(black,white,m.Region(),30)
    assert result['mean_difference'] == 1
    assert result['changed_pixel_fraction'] == 1
    with pytest.raises(m.HTTPException): m.compare(black,white[:50],m.Region(),30)


def test_power_reports_current_alarm_and_unknown_sensor(tmp_path):
    assert m.power_status(tmp_path)['undervoltage'] is None
    sensor = tmp_path / 'hwmon7'
    sensor.mkdir()
    (sensor / 'name').write_text('rpi_volt\n')
    for alarm, expected in [('1', True), ('0', False), ('invalid', None)]:
        (sensor / 'in0_lcrit_alarm').write_text(alarm)
        assert m.power_status(tmp_path)['undervoltage'] is expected


def test_serial_and_relay_api_auth_validation(client, monkeypatch):
    m.serial_monitor.append(b'boot <script>text</script>')
    assert 'boot <script>text</script>' in client.get('/api/serial.txt').text
    assert client.get('/api/serial?limit=2001').status_code == 422
    assert client.get('/api/serial?after=-1').status_code == 422
    calls = []
    monkeypatch.setattr(m.relay, 'reset', lambda count: calls.append(count) or {'cycles': count})
    assert client.post('/api/reset', json={'count':6}).status_code == 422
    assert client.post('/api/reset', json={'count':5,'confirm_data_loss':True}).status_code == 422
    assert not calls
    assert client.post('/api/reset', json={'count':6,'confirm_data_loss':True}).json()['cycles'] == 6
    assert calls == [6]
    client.headers.pop('authorization')
    for path in ('/api/serial', '/api/serial.txt'):
        assert client.get(path).status_code == 401
    assert client.post('/api/power', json={'on':True}, headers={'X-Testbench':'1'}).status_code == 401
