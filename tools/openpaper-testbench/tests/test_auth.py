import time
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from test_app import m, client
from auth import WebAuth, hash_password, verify_password, COOKIE, SESSION_SECONDS


def test_password_hash_and_fail_closed():
    hashed = hash_password('correct')
    assert verify_password('correct', hashed)
    assert not verify_password('wrong', hashed)
    assert not verify_password('correct', 'broken')
    with pytest.raises(HTTPException) as exc:
        WebAuth('').login('anything', 'one')
    assert exc.value.status_code == 503


def test_revocation_expiry_and_rate_limit(monkeypatch):
    auth = WebAuth(hash_password('correct'))
    now = time.monotonic()
    monkeypatch.setattr(time, 'monotonic', lambda: now)
    monkeypatch.setattr(time, 'time', lambda: now)
    token = auth.login('correct', 'one')
    assert auth.valid(token)
    assert token not in auth.sessions
    auth.logout(token)
    assert not auth.valid(token)
    token = auth.login('correct', 'one')
    now += SESSION_SECONDS + 1
    assert not auth.valid(token)
    for _ in range(5):
        with pytest.raises(HTTPException) as exc:
            auth.login('wrong', 'one')
        assert exc.value.status_code == 401
    with pytest.raises(HTTPException) as exc:
        auth.login('correct', 'one')
    assert exc.value.status_code == 429
    now += 61
    assert auth.valid(auth.login('correct', 'one'))


def test_public_routes_cookie_logout_and_proxy_spoofing(client):
    # A reverse proxy connects over loopback, but must never inherit kiosk trust.
    remote = TestClient(m.app, base_url='https://rig.example', client=('127.0.0.1', 9000),
                        headers={'X-Testbench-Public': '1', 'X-Testbench': '1'})
    for path in ('/api/status', '/api/camera.jpg', '/api/stream.mjpg', '/api/serial.txt',
                 '/api/serial', '/api/photos', '/openapi.json', '/healthz'):
        assert remote.get(path).status_code == 401
        assert remote.get(path, headers={'Host':'localhost'}).status_code == 401
    assert remote.get('/', follow_redirects=False).headers['location'] == '/login.html'
    assert remote.get('/docs', follow_redirects=False).status_code == 303
    assert remote.get('/login.html').status_code == 200
    remote.cookies.set('testbench', 'test-secret')
    assert remote.get('/api/status').status_code == 401
    assert remote.post('/api/login', json={'password':'test-password'}, headers={'Origin':'http://rig.example'}).status_code == 403
    response = remote.post('/api/login', json={'password':'test-password'}, headers={'Origin':'https://rig.example'})
    assert response.status_code == 200
    cookie = response.headers.get_list('set-cookie')[0]
    assert all(flag in cookie for flag in ('HttpOnly', 'Secure', 'SameSite=lax'))
    token = remote.cookies.get(COOKIE)
    assert token not in ('test-password', 'test-secret')
    assert remote.get('/api/status').status_code == 200
    assert remote.post('/api/power', json={'on':False}, headers={'Origin':'https://evil.example'}).status_code == 403
    assert remote.post('/api/logout', json={}).status_code == 200
    remote.cookies.set(COOKIE, token)
    assert remote.get('/api/status').status_code == 401
    assert remote.get('/api/status', headers={'Authorization':'Bearer test-secret'}).status_code == 200


def test_kiosk_local_only(client):
    kiosk = TestClient(m.app, base_url='http://127.0.0.1:8080', client=('127.0.0.1', 9000))
    assert kiosk.get('/api/status').status_code == 200
    assert kiosk.get('/touch.html').status_code == 200
    assert kiosk.get('/api/status', headers={'Host':'external.example'}).status_code == 401
    assert kiosk.get('/api/status', headers={'X-Testbench-Public':'1'}).status_code == 401


def test_remembered_session_survives_restart_and_logout(tmp_path):
    path=tmp_path/'sessions.json'
    hashed=hash_password('correct')
    auth=WebAuth(hashed,path)
    persistent=auth.login('correct','one',remember=True)
    temporary=auth.login('correct','two')
    contents=path.read_text()
    assert persistent not in contents and temporary not in contents and 'correct' not in contents
    assert path.stat().st_mode & 0o777 == 0o600
    restored=WebAuth(hashed,path)
    assert restored.valid(persistent)
    assert not restored.valid(temporary)
    assert not WebAuth(hash_password('changed'),path).valid(persistent)
    restored.logout(persistent)
    assert not WebAuth(hashed,path).valid(persistent)


def test_remembered_expiry_and_corrupt_store(tmp_path,monkeypatch):
    from auth import REMEMBER_SECONDS
    path=tmp_path/'sessions.json';hashed=hash_password('correct')
    now=time.time();monkeypatch.setattr(time,'time',lambda:now)
    auth=WebAuth(hashed,path);token=auth.login('correct','one',remember=True)
    now+=REMEMBER_SECONDS+1
    assert not WebAuth(hashed,path).valid(token)
    assert not auth.valid(token)
    path.write_text('broken')
    assert not WebAuth(hashed,path).valid(token)


def test_remembered_session_survives_boot_before_clock_sync(tmp_path, monkeypatch):
    from auth import REMEMBER_SECONDS
    path = tmp_path / 'sessions.json'
    hashed = hash_password('correct')
    now = time.time()
    monkeypatch.setattr(time, 'time', lambda: now)
    auth = WebAuth(hashed, path)
    token = auth.login('correct', 'one', remember=True)
    issued = now
    now -= 2 * 24 * 60 * 60
    restarted = WebAuth(hashed, path)
    assert restarted.valid(token)
    # Another login before NTP must not remove the first persisted session.
    restarted.login('correct', 'two', remember=True)
    now = issued + 60
    assert WebAuth(hashed, path).valid(token)
    now = issued + REMEMBER_SECONDS + 1
    assert not restarted.valid(token)


def test_session_probe_requires_authentication_and_logout_revokes_it(client):
    remote = TestClient(m.app, base_url='https://rig.example',
                        headers={'X-Testbench-Public': '1', 'X-Testbench': '1'})
    assert remote.get('/api/session').status_code == 401
    remote.post('/api/login', json={'password': 'test-password', 'remember': True})
    assert remote.get('/api/session').json() == {'ok': True}
    assert remote.post('/api/logout', json={}, headers={'Origin': 'https://evil.example'}).status_code == 403
    assert remote.post('/api/logout', json={}).status_code == 200
    assert remote.get('/api/session').status_code == 401


def test_camera_bookmark_login_and_remember_cookie(client, tmp_path, monkeypatch):
    from auth import REMEMBER_SECONDS
    password_hash=m.web_auth.password_hash
    sessions_file=tmp_path/"web-sessions.json"
    monkeypatch.setattr(m,"web_auth",WebAuth(password_hash,sessions_file))
    remote=TestClient(m.app,base_url='https://rig.example',headers={'X-Testbench-Public':'1','X-Testbench':'1'})
    response=remote.get('/cameras/frame-2',follow_redirects=False)
    assert response.status_code==303
    assert response.headers['location']=='/login.html?next=%2Fcameras%2Fframe-2'
    response=remote.post('/api/login',json={'password':'test-password','remember':True})
    assert 'Max-Age='+str(REMEMBER_SECONDS) in response.headers.get_list('set-cookie')[0]
    remembered_token=remote.cookies.get(COOKIE)
    monkeypatch.setattr(m,"web_auth",WebAuth(password_hash,sessions_file))
    assert remote.get('/cameras/frame-2').status_code==200
    assert remote.get('/cameras/detail').status_code==200
    assert remote.get('/settings').status_code==200
    assert remote.get('/cameras/missing-frame').status_code==404
    assert remote.get('/',follow_redirects=False).headers['location']=='/cameras/frame-1'
    remote.post('/api/logout',json={})
    monkeypatch.setattr(m,"web_auth",WebAuth(password_hash,sessions_file))
    remote.cookies.set(COOKIE,remembered_token)
    assert remote.get('/api/status').status_code==401
    remote.cookies.clear()
    response=remote.post('/api/login',json={'password':'test-password','remember':False})
    assert 'Max-Age' not in response.headers.get_list('set-cookie')[0]
