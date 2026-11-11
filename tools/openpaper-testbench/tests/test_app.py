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


def test_multiframe_api_isolation_and_persistence(client, monkeypatch, tmp_path):
    from rig import Rig
    isolated = Rig(tmp_path, m.Camera, True)
    monkeypatch.setattr(m, 'rig', isolated)
    c = client.get('/api/rig').json()
    c['frames'][0]['camera']='demo-camera-1'
    c['frames'][1]['camera']='demo-camera-2'
    c['detail_camera']='demo-camera-3'
    saved=client.post('/api/rig',json=c)
    assert saved.status_code==200
    assert Rig(tmp_path,m.Camera,True).snapshot().detail_camera=='demo-camera-3'
    assert client.post('/api/rig',json=c).status_code==409
    for fid in ('frame-1','frame-2'):
        cam=isolated.camera(fid)
        for _ in range(100):
            if cam.frame is not None: break
            time.sleep(.01)
        assert client.get('/api/camera.jpg',params={'frame_id':fid}).status_code==200
    assert client.post('/api/reference?frame_id=frame-1',json={}).status_code==200
    assert client.post('/api/analyze?frame_id=frame-1',json={}).json()['matches_reference']
    assert client.post('/api/analyze?frame_id=frame-2',json={}).status_code==409
    # Change only camera 2's pixels: camera 1/reference must stay intact.
    other=isolated.camera('frame-2');other.stop.set();isolated.workers[other.device].join(2)
    with other.lock: other.frame[:]=0;other.updated=time.monotonic()
    assert client.post('/api/analyze?frame_id=frame-1',json={}).json()['matches_reference']
    assert client.post('/api/reference?frame_id=frame-2',json={}).status_code==200
    assert len(list(tmp_path.glob('reference-*.png')))==2
    c=saved.json();c['frames'][0]['corners'][0]={'x':.05,'y':.05}
    assert client.post('/api/rig',json=c).status_code==200
    assert client.post('/api/analyze?frame_id=frame-1',json={}).status_code==409
    assert client.get('/api/status?frame_id=missing').status_code==404
    assert client.post('/api/power?frame_id=frame-2',json={'on':False}).status_code==409
    assert client.get('/api/status').status_code==200
    isolated.close()


def test_rig_and_light_auth_validation(client):
    assert client.post('/api/light',json={'mode':'invalid','kelvin':7000}).status_code==422
    previous = m.light.settings.copy()
    try:
        for mode in ('on','off','auto'):
            response = client.post('/api/light',json={'mode':mode,'kelvin':7000})
            assert response.status_code == 200
            assert response.json()['mode'] == mode
            assert client.get('/api/light').json()['mode'] == mode
        response = client.post('/api/light',json={'enabled':False,'brightness':70,'kelvin':4950})
        assert response.json()['mode'] == 'off' and response.json()['brightness'] == 100
    finally:
        m.light.configure(previous)
    assert client.post('/api/light',json={'enabled':True,'brightness':101,'kelvin':5000}).status_code==422
    assert client.post('/api/ui/presence',json={'client_id':'bad','visible':True}).status_code==422
    assert client.post('/api/ui/presence',json={'client_id':'browser-test-0001','visible':True}).status_code==200
    assert client.post('/api/ui/presence',json={'client_id':'browser-test-0001','visible':False}).status_code==200
    client.headers.pop('authorization')
    for path in ('/api/rig','/api/devices','/api/light'):
        assert client.get(path).status_code==401
    assert client.post('/api/ui/presence',headers={'X-Testbench':'1'},json={'client_id':'browser-test-0001','visible':True}).status_code==401


def test_mapping_cannot_change_during_relay_action(client, monkeypatch):
    entered = threading.Event()
    finish = threading.Event()
    errors = []
    def power(on):
        entered.set()
        assert finish.wait(3)
        return {'commanded_power':on}
    monkeypatch.setattr(m.relay, 'power', power)
    def run():
        try:
            assert client.post('/api/power',json={'on':True}).status_code==200
        except Exception as exc: errors.append(exc)
    worker=threading.Thread(target=run)
    worker.start()
    try:
        assert entered.wait(2)
        config=client.get('/api/rig').json()
        assert client.post('/api/rig',json=config).status_code==409
    finally:
        finish.set();worker.join(3)
    assert not errors and m.rig.active_actions==0


def test_rectified_photo_uses_selected_frame_corners(client, monkeypatch, tmp_path):
    from rig import Rig
    isolated=Rig(tmp_path,m.Camera,True)
    monkeypatch.setattr(m,'rig',isolated)
    c=isolated.snapshot()
    c.frames[0].camera='demo-camera-1'
    from rig import Point
    c.frames[0].corners=[Point(x=x,y=y) for x,y in [(.2,.2),(.8,.2),(.8,.8),(.2,.8)]]
    isolated.save(c)
    camera=isolated.camera('frame-1')
    for _ in range(100):
        if camera.frame is not None:break
        time.sleep(.01)
    response=client.post('/api/photos?frame_id=frame-1&cropped=true',json={})
    assert response.status_code==201
    result=response.json()
    assert result['frame_id']=='frame-1' and result['cropped'] and not result['detail']
    image=m.cv2.imdecode(np.frombuffer(client.get(result['url']).content,np.uint8),m.cv2.IMREAD_COLOR)
    assert image.shape[:2]==(287,479)
    assert client.post('/api/photos?cropped=true',json={}).status_code==422
    assert client.post('/api/photos?frame_id=frame-1&detail=true&cropped=true',json={}).status_code==422
    isolated.close()


@pytest.mark.parametrize('width,height', [(1920,1080), (3840,2160)])
def test_photo_keeps_native_resolution_independent_of_live_quality(client, monkeypatch, width, height):
    import cv2
    image = np.full((height,width,3),150,np.uint8)
    monkeypatch.setattr(m.camera,'snapshot',lambda:image.copy())
    for quality, shape in [('standard',(720,1280)),('high',(height,width))]:
        response = client.get('/api/camera.jpg?quality='+quality)
        decoded = cv2.imdecode(np.frombuffer(response.content,np.uint8),cv2.IMREAD_COLOR)
        assert decoded.shape[:2] == shape
        photo = client.post('/api/photos',json={}).json()
        assert photo['resolution'] == [width,height]
        assert photo['jpeg_quality'] == 100
        saved = cv2.imdecode(np.frombuffer(client.get(photo['url']).content,np.uint8),cv2.IMREAD_COLOR)
        assert saved.shape == image.shape
    assert client.get('/api/camera.jpg?quality=invalid').status_code == 422


def test_photo_preserves_fine_colour_detail(client, monkeypatch):
    # One-pixel red/blue stripes expose chroma subsampling even at JPEG quality 100.
    source = np.zeros((64,64,3),np.uint8)
    source[:,::2] = (0,0,255)
    source[:,1::2] = (255,0,0)
    monkeypatch.setattr(m.camera,'snapshot',lambda:source.copy())
    photo = client.post('/api/photos',json={}).json()
    response = client.get(photo['url'])
    assert response.headers['content-type'] == 'image/jpeg'
    saved = m.cv2.imdecode(np.frombuffer(response.content,np.uint8),m.cv2.IMREAD_COLOR)
    assert np.abs(saved.astype(float)-source.astype(float)).max() <= 3


def test_portrait_preview_photo_and_reference_agree(client, monkeypatch, tmp_path):
    from rig import Rig
    isolated=Rig(tmp_path,m.Camera,True)
    monkeypatch.setattr(m,'rig',isolated)
    c=isolated.snapshot();c.frames[0].camera='demo-camera-1';c.frames[0].rotation=90
    isolated.save(c)
    camera=isolated.camera('frame-1')
    original=np.zeros((1080,1920,3),np.uint8);original[:300,:300]=255
    monkeypatch.setattr(camera,'snapshot',lambda:original.copy())
    try:
        response=client.get('/api/camera.jpg?frame_id=frame-1&quality=high')
        img=m.cv2.imdecode(np.frombuffer(response.content,np.uint8),m.cv2.IMREAD_COLOR)
        assert img.shape[:2]==(1920,1080)
        assert img[:250,-250:].mean()>250
        photo=client.post('/api/photos?frame_id=frame-1',json={}).json()
        assert photo['resolution']==[1080,1920]
        assert client.post('/api/reference?frame_id=frame-1',json={}).status_code==200
        assert client.post('/api/analyze?frame_id=frame-1',json={}).json()['matches_reference']
    finally:isolated.close()


def test_gray_calibration_uses_raw_rotated_region_and_corrects_outputs(client, monkeypatch, tmp_path):
    from gray_calibration import GrayCalibration
    from rig import FrameProfile
    monkeypatch.setattr(m.camera, 'gray', GrayCalibration(tmp_path / 'gray.json'))
    m.camera.stop.set()
    time.sleep(.3)
    with m.camera.lock:
        m.camera.frame = np.full((100, 200, 3), 30, np.uint8)
        m.camera.frame[:50, :100] = (90, 120, 150)
        m.camera.updated = time.monotonic()
    monkeypatch.setattr(m, 'selected_profile', lambda frame_id=None: FrameProfile(id='test', name='Test', rotation=90))
    monkeypatch.setattr(m.rig, 'camera_key', lambda key: m.camera)
    # Original top-left becomes top-right after clockwise rotation.
    body = {'region': {'x': .5, 'y': 0, 'width': .5, 'height': .5}, 'target': 118}
    assert client.get('/api/camera/gray-calibration').json() == {'enabled': False}
    result = client.post('/api/camera/gray-calibration', json=body)
    assert result.status_code == 200
    assert result.json()['sample_rgb'] == [150, 120, 90]
    repeated = client.post('/api/camera/gray-calibration', json=body)
    assert repeated.json() == result.json(), 'Recalibration must not compound gains'
    for url in ('/api/camera.jpg?quality=high', client.post('/api/photos', json={}).json()['url']):
        img = m.cv2.imdecode(np.frombuffer(client.get(url).content, np.uint8), m.cv2.IMREAD_COLOR)
        assert np.max(np.abs(img[10:40, 60:90].astype(float) - 118)) <= 2
    for bad in ({**body, 'target': 0}, {**body, 'target': 255}, {**body, 'region': {'x': .99, 'width': .1}}, {**body, 'region': {'width': .001}}):
        assert client.post('/api/camera/gray-calibration', json=bad).status_code == 422
    m.camera.controls.lock.acquire()
    try:
        assert client.post('/api/camera/gray-calibration', json=body).status_code == 409
    finally:
        m.camera.controls.lock.release()
    assert client.post('/api/camera/gray-calibration/reset', json={}).json() == {'enabled': False}
    assert np.array_equal(m.camera.snapshot(), m.camera.frame)
    client.headers.pop('authorization')
    assert client.get('/api/camera/gray-calibration').status_code == 401
    assert client.post('/api/camera/gray-calibration', json=body, headers={'X-Testbench':'1'}).status_code == 401


def test_gray_api_isolates_camera_and_invalidates_its_reference(client, monkeypatch, tmp_path):
    from rig import Rig
    isolated = Rig(tmp_path, m.Camera, True)
    monkeypatch.setattr(m, 'rig', isolated)
    monkeypatch.setattr(m, 'DATA', tmp_path)
    config = isolated.snapshot()
    for i, profile in enumerate(config.frames, 1):
        profile.camera = f'demo-camera-{i}'
    isolated.save(config)
    try:
        for profile in isolated.snapshot().frames:
            cam = isolated.camera(profile.id)
            for _ in range(100):
                if cam.frame is not None: break
                time.sleep(.01)
            assert client.post('/api/reference?frame_id='+profile.id, json={}).status_code == 200
        body = {'region': {'x': .02, 'y': .02, 'width': .08, 'height': .08}, 'target': 118}
        assert client.post('/api/camera/gray-calibration?frame_id=frame-1', json=body).status_code == 200
        assert not isolated.reference_path(isolated.profile('frame-1')).exists()
        assert isolated.reference_path(isolated.profile('frame-2')).exists()
        assert client.get('/api/camera/gray-calibration?frame_id=frame-1').json()['enabled']
        assert not client.get('/api/camera/gray-calibration?frame_id=frame-2').json()['enabled']
        assert client.post('/api/camera/gray-calibration?frame_id=missing', json=body).status_code == 404
    finally:
        isolated.close()
