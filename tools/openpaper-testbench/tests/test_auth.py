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
    assert all(flag in cookie for flag in ('HttpOnly', 'Secure', 'SameSite=strict'))
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
