"""OpenPaper test rig. One process owns the camera and GPIO line."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import glob
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import threading
import time
from urllib.parse import urlsplit

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field, model_validator
from typing import Literal
from fastapi import Query
from hardware import Relay, SerialMonitor
from auth import WebAuth, COOKIE, SESSION_SECONDS
from camera_controls import CameraControls
from night_capture import NightCapture

DATA = Path(os.getenv('DATA_DIR', '/data'))
DATA.mkdir(parents=True, exist_ok=True)
PHOTOS = DATA / 'photos'
PHOTOS.mkdir(exist_ok=True)
START = time.monotonic()
TOKEN = os.getenv('API_TOKEN', '')
web_auth = WebAuth(os.getenv('WEB_PASSWORD_HASH', ''))
DEMO = os.getenv('DEMO_MODE', '0') == '1'
MAX_PHOTOS = max(1, int(os.getenv('MAX_PHOTOS', '200')))


class Camera:
    def __init__(self):
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.condition = threading.Condition(self.lock)
        self.sequence = 0
        self.frame = None
        self.updated = 0.0
        self.error = 'Kamera startet'
        self.device = os.getenv('CAMERA_DEVICE', '/dev/video0')
        self.fps = max(1, min(30, int(os.getenv('CAMERA_FPS', '5'))))
        self.controls = CameraControls(self.device, DATA / 'camera-controls.json')

    def run(self):
        cap = None
        try:
            while not self.stop.is_set():
                if DEMO:
                    frame = np.full((480, 800, 3), 237, np.uint8)
                    cv2.rectangle(frame, (140, 60), (660, 420), (36, 40, 44), 12)
                    cv2.putText(frame, 'OpenPaper 7', (210, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (30, 40, 30), 3)
                    cv2.putText(frame, 'DEMO - no camera', (205, 270), cv2.FONT_HERSHEY_SIMPLEX, .8, (50, 50, 170), 2)
                    ok = True
                else:
                    if cap is None:
                        cap = cv2.VideoCapture(self.device, cv2.CAP_V4L2)
                        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, int(os.getenv('CAMERA_WIDTH', '1280')))
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, int(os.getenv('CAMERA_HEIGHT', '720')))
                        cap.set(cv2.CAP_PROP_FPS, self.fps)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        try:
                            self.controls.initialize()
                        except Exception as exc:
                            self.controls.error = str(getattr(exc, 'detail', exc))
                    ok, frame = cap.read()
                with self.lock:
                    if ok:
                        self.frame, self.updated, self.error = frame, time.monotonic(), None
                        self.sequence += 1
                        self.condition.notify_all()
                    else:
                        self.frame, self.error = None, f'Keine Bilder von {self.device}; USB-Verbindung prüfen'
                if not ok:
                    cap.release()
                    cap = None
                    self.stop.wait(2)
                elif DEMO:
                    self.stop.wait(1 / self.fps)
        finally:
            if cap is not None:
                cap.release()

    def snapshot(self):
        with self.lock:
            if self.frame is None or time.monotonic() - self.updated > 4:
                raise HTTPException(503, self.error or 'Kamerabild ist veraltet')
            return self.frame.copy()

    def next_frame(self, after, timeout=2):
        with self.condition:
            if not self.condition.wait_for(lambda: self.sequence > after or self.stop.is_set(), timeout):
                raise HTTPException(503, 'Keine neuen Kamerabilder während Nachtaufnahme')
            if self.stop.is_set() or self.frame is None or time.monotonic() - self.updated > 4:
                raise HTTPException(503, 'Kamera nicht verfügbar')
            return self.frame.copy(), self.sequence

    def status(self):
        with self.lock:
            age = round(time.monotonic() - self.updated, 2) if self.updated else None
            return {'connected': self.frame is not None and age < 4, 'device': self.device,
                    'frame_age_seconds': age, 'error': self.error,
                    'resolution': [self.frame.shape[1], self.frame.shape[0]] if self.frame is not None else None}


class Button:
    def __init__(self):
        self.lock = threading.Lock()
        self.line = None
        self.enabled = os.getenv('BUTTON_ENABLED', '0') == '1'
        self.pin = int(os.getenv('BUTTON_GPIO', '26'))
        self.error = None
        self.count = 0
        self.last = None
        self.last_mono = 0.0
        self.pressed = False

    def open(self):
        if not self.enabled or DEMO:
            return
        try:
            import gpiod
            from gpiod.line import Direction, Value
            self.line = gpiod.request_lines(os.getenv('GPIO_CHIP', '/dev/gpiochip0'), consumer='openpaper-button',
                config={self.pin: gpiod.LineSettings(direction=Direction.OUTPUT,
                    active_low=os.getenv('BUTTON_ACTIVE_LOW', '0') == '1', output_value=Value.INACTIVE)})
        except Exception as exc:
            self.error = str(exc)

    def press(self, duration_ms):
        if not self.enabled:
            raise HTTPException(503, 'Knopf deaktiviert: Verdrahtung prüfen, dann BUTTON_ENABLED=1 setzen')
        if not DEMO and self.line is None:
            raise HTTPException(503, self.error or 'GPIO nicht verfügbar')
        if not self.lock.acquire(blocking=False):
            raise HTTPException(409, 'Knopf wird bereits gedrückt')
        try:
            if time.monotonic() - self.last_mono < 1:
                raise HTTPException(429, 'Mindestens eine Sekunde zwischen Tastendrücken warten')
            self.pressed = True
            try:
                if self.line:
                    from gpiod.line import Value
                    self.line.set_value(self.pin, Value.ACTIVE)
                time.sleep(duration_ms / 1000)
            finally:
                try:
                    if self.line:
                        self.line.set_value(self.pin, Value.INACTIVE)
                finally:
                    self.pressed = False
            self.count += 1
            self.last = datetime.now(timezone.utc).isoformat()
            self.last_mono = time.monotonic()
            return {'pressed': True, 'duration_ms': duration_ms, 'at': self.last, 'demo': DEMO}
        finally:
            self.lock.release()

    def close(self):
        with self.lock:
            if self.line:
                from gpiod.line import Value
                self.line.set_value(self.pin, Value.INACTIVE)
                self.line.release()
                self.line = None


camera, button = Camera(), Button()
relay, serial_monitor = Relay(), SerialMonitor()
reference_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app):
    button.open()
    serial_monitor.start()
    worker = threading.Thread(target=camera.run, daemon=True)
    worker.start()
    yield
    await asyncio.to_thread(night_capture.close)
    camera.stop.set()
    await asyncio.to_thread(serial_monitor.close)
    await asyncio.to_thread(button.close)
    await asyncio.to_thread(worker.join, 5)


app = FastAPI(title='OpenPaper Testbench API', version='1.3.1', lifespan=lifespan)


def public_request(request):
    return bool(request.headers.get('x-testbench-public'))


def local(request):
    return (request.client is not None and request.client.host in ('127.0.0.1', '::1')
            and request.url.hostname in ('127.0.0.1', '::1', 'localhost')
            and not public_request(request))


def authorized(request):
    if local(request):
        return True
    supplied = request.headers.get('authorization', '')
    if TOKEN and supplied.startswith('Bearer ') and hmac.compare_digest(supplied[7:].encode(), TOKEN.encode()):
        return True
    return web_auth.valid(request.cookies.get(COOKIE, ''))


def protected_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


@app.middleware('http')
async def security(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        if origin and urlsplit(origin).netloc != request.headers.get('host'):
            return protected_headers(JSONResponse({'detail': 'Fremder Origin nicht erlaubt'}, status_code=403))
        if not request.headers.get('authorization') and request.headers.get('x-testbench') != '1':
            return protected_headers(JSONResponse({'detail': 'X-Testbench: 1 oder Bearer-Token erforderlich'}, status_code=403))
    open_paths = ('/login.html', '/login.css', '/login.js', '/api/login')
    if request.url.path not in open_paths and not authorized(request):
        if request.url.path.startswith('/api/') or request.url.path in ('/healthz', '/openapi.json'):
            response = JSONResponse({'detail': 'Anmeldung erforderlich'}, status_code=401)
        else:
            response = RedirectResponse('/login.html', status_code=303)
        return protected_headers(response)
    return protected_headers(await call_next(request))


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=256)


@app.post('/api/login')
def login(body: Login, request: Request):
    origin = request.headers.get('origin')
    if public_request(request) and origin and urlsplit(origin).scheme != 'https':
        raise HTTPException(403, 'Anmeldung nur über HTTPS')
    # The Balena proxy is shared. Do not trust client-supplied forwarding headers
    # for rate-limit keys; public attempts share one bucket.
    source = 'public' if public_request(request) else (request.client.host if request.client else 'unknown')
    token = web_auth.login(body.password, source)
    response = JSONResponse({'ok': True, 'expires_in': SESSION_SECONDS})
    response.set_cookie(COOKIE, token, httponly=True, secure=public_request(request) or request.url.scheme == 'https',
                        samesite='strict', max_age=SESSION_SECONDS, path='/')
    response.delete_cookie('testbench', path='/')  # Retire the former raw API-token cookie.
    return response


@app.post('/api/logout')
def logout(request: Request):
    web_auth.logout(request.cookies.get(COOKIE, ''))
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE, httponly=True, secure=public_request(request) or request.url.scheme == 'https',
                           samesite='strict', path='/')
    return response


@app.get('/healthz')
def health():
    return {'ok': True}


def read_text(path, default='unbekannt'):
    try:
        return Path(path).read_text().strip('\x00\n ')
    except OSError:
        return default


def network_urls():
    try:
        interfaces = json.loads(subprocess.check_output(['ip', '-j', '-4', 'addr'], timeout=2))
        return [f"http://{address['local']}:{os.getenv('PORT', '8080')}"
                for interface in interfaces if interface['ifname'].startswith(('eth', 'en', 'wl'))
                for address in interface.get('addr_info', []) if address.get('scope') == 'global']
    except (OSError, subprocess.SubprocessError, ValueError):
        return []


def power_status(root='/sys/class/hwmon'):
    for sensor in Path(root).glob('hwmon*'):
        if read_text(sensor / 'name', '') == 'rpi_volt':
            alarm = read_text(sensor / 'in0_lcrit_alarm', '')
            if alarm in ('0', '1'):
                return {'undervoltage': alarm == '1', 'source': 'rpi_volt'}
    return {'undervoltage': None, 'source': None}


@app.get('/api/status')
def status():
    disk = shutil.disk_usage(DATA)
    temperature = read_text('/sys/class/thermal/thermal_zone0/temp', '')
    return {'name': 'OpenPaper Testbench', 'demo': DEMO, 'uptime_seconds': int(time.monotonic() - START),
            'hostname': socket.gethostname(), 'device_uuid': os.getenv('BALENA_DEVICE_UUID'), 'network_urls': network_urls(),
            'model': read_text('/proc/device-tree/model'),
            'temperature_c': float(temperature) / 1000 if temperature.isdigit() else None,
            'storage_free_mb': round(disk.free / 1024**2),
            'power': power_status(),
            'camera': camera.status(),
            'relay': relay.status(), 'serial': serial_monitor.status(),
            'button': {'enabled': button.enabled, 'available': button.enabled and (DEMO or button.line is not None),
                       'gpio': button.pin, 'pressed': button.pressed, 'count': button.count,
                       'last_press': button.last, 'error': button.error},
            'reference_available': (DATA / 'reference.png').exists(),
            'video_devices': sorted(glob.glob('/dev/video*')),
            'framebuffers': sorted(glob.glob('/dev/fb*')),
            'openpaper': {'telemetry': 'serial_connected' if serial_monitor.connected else 'not_connected',
                          'note': 'UART-Rohdaten unter /api/serial; Relaiszustand ohne elektrische Rückmeldung.'}}


def jpeg(frame):
    ok, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        raise HTTPException(500, 'JPEG konnte nicht erstellt werden')
    return encoded.tobytes()


@app.get('/api/camera.jpg')
def camera_image():
    return Response(jpeg(camera.snapshot()), media_type='image/jpeg')


@app.get('/api/stream.mjpg')
async def stream():
    camera.snapshot()  # Return 503 before starting an unavailable stream.
    async def frames():
        while True:
            try:
                data = await asyncio.to_thread(lambda: jpeg(camera.snapshot()))
            except HTTPException:
                return
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + data + b'\r\n'
            await asyncio.sleep(1 / camera.fps)
    return StreamingResponse(frames(), media_type='multipart/x-mixed-replace; boundary=frame')


photo_lock = threading.Lock()


def save_photo(frame):
    data = jpeg(frame)
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(4) + '.jpg'
    with photo_lock:
        (PHOTOS / name).write_bytes(data)
        files = sorted(PHOTOS.glob('*.jpg'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in files[MAX_PHOTOS:]:
            old.unlink(missing_ok=True)
    return {'id': name, 'url': f'/api/photos/{name}', 'bytes': len(data), 'demo': DEMO}


night_capture = NightCapture(camera, camera.controls, save_photo)


@app.post('/api/photos', status_code=201)
def take_photo():
    return save_photo(camera.snapshot())


class CameraSettings(BaseModel):
    values: dict[str, int] = Field(min_length=1, max_length=6)


class NightRequest(BaseModel):
    seconds: int = Field(default=10, ge=2, le=60)


@app.get('/api/camera/controls')
def camera_controls():
    return camera.controls.info()


@app.post('/api/camera/controls')
def set_camera_controls(body: CameraSettings):
    return camera.controls.apply(body.values)


@app.post('/api/camera/restore')
def restore_camera_controls():
    return camera.controls.restore()


@app.post('/api/camera/night-profile')
def camera_night_profile():
    with camera.controls.exclusive():
        return camera.controls.apply(camera.controls.night_values())


@app.post('/api/camera/night', status_code=202)
def start_night_photo(body: NightRequest):
    return night_capture.start(body.seconds)


@app.get('/api/camera/night')
def night_photo_status():
    return night_capture.status()


@app.post('/api/camera/night/cancel')
def cancel_night_photo():
    return night_capture.cancel()


@app.get('/api/photos')
def list_photos():
    return [{'id': p.name, 'url': f'/api/photos/{p.name}'} for p in sorted(PHOTOS.glob('*.jpg'), reverse=True)]


@app.get('/api/photos/{name}')
def photo(name: str):
    if Path(name).name != name or not name.endswith('.jpg') or not (PHOTOS / name).is_file():
        raise HTTPException(404, 'Foto nicht gefunden')
    return FileResponse(PHOTOS / name, media_type='image/jpeg')


class Press(BaseModel):
    duration_ms: int = Field(default=250, ge=50, le=3000)


@app.post('/api/button/press')
def press(body: Press):
    return button.press(body.duration_ms)


class PowerCommand(BaseModel):
    on: bool


class ResetCommand(BaseModel):
    count: Literal[1, 6] = 1
    confirm_data_loss: bool = False


@app.post('/api/power')
def frame_power(body: PowerCommand):
    return relay.power(body.on)


@app.post('/api/reset')
def frame_reset(body: ResetCommand):
    if body.count == 6 and not body.confirm_data_loss:
        raise HTTPException(422, '6× Reset kann WLAN und Aktivierung löschen; confirm_data_loss=true erforderlich')
    return relay.reset(body.count)


@app.get('/api/serial')
def serial_output(after: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=2000)):
    return serial_monitor.read(after, limit)


@app.get('/api/serial.txt')
def serial_text():
    lines = serial_monitor.read(0, 2000)['lines']
    return Response(''.join(f"{line['at']} {line['text']}\n" for line in lines),
                    media_type='text/plain', headers={'Content-Disposition': 'attachment; filename="openpaper-serial.txt"'})


class Region(BaseModel):
    x: float = Field(default=0, ge=0, lt=1)
    y: float = Field(default=0, ge=0, lt=1)
    width: float = Field(default=1, gt=0, le=1)
    height: float = Field(default=1, gt=0, le=1)

    @model_validator(mode='after')
    def bounds(self):
        if self.x + self.width > 1.00001 or self.y + self.height > 1.00001:
            raise ValueError('Bildausschnitt liegt außerhalb des Bildes')
        return self


def crop(frame, region):
    h, w = frame.shape[:2]
    x, y = int(region.x * w), int(region.y * h)
    right, bottom = min(w, int((region.x + region.width) * w)), min(h, int((region.y + region.height) * h))
    if right - x < 8 or bottom - y < 8:
        raise HTTPException(422, 'Bildausschnitt muss mindestens 8 × 8 Pixel groß sein')
    return frame[y:bottom, x:right]


class Reference(BaseModel):
    region: Region = Field(default_factory=Region)


@app.post('/api/reference')
def save_reference(body: Reference):
    frame = camera.snapshot()
    crop(frame, body.region)
    with reference_lock:
        ok, png = cv2.imencode('.png', frame)
        if not ok:
            raise HTTPException(500, 'Referenz konnte nicht erstellt werden')
        (DATA / 'reference.png').write_bytes(png.tobytes())
        (DATA / 'reference.json').write_text(body.region.model_dump_json())
    return {'saved': True, 'region': body.region, 'demo': DEMO}


class Analysis(BaseModel):
    max_difference: float = Field(default=0.05, ge=0, le=1)
    pixel_threshold: int = Field(default=30, ge=1, le=255)


def compare(current, reference, region, pixel_threshold):
    if current.shape != reference.shape:
        raise HTTPException(409, 'Kameraauflösung geändert: Referenz neu aufnehmen')
    a = cv2.cvtColor(crop(current, region), cv2.COLOR_BGR2GRAY)
    b = cv2.cvtColor(crop(reference, region), cv2.COLOR_BGR2GRAY)
    delta = cv2.absdiff(cv2.GaussianBlur(a, (5, 5), 0), cv2.GaussianBlur(b, (5, 5), 0))
    return {'mean_difference': float(np.mean(delta) / 255),
            'changed_pixel_fraction': float(np.mean(delta > pixel_threshold)),
            'sharpness': float(cv2.Laplacian(a, cv2.CV_64F).var()), 'brightness': float(np.mean(a))}


@app.post('/api/analyze')
def analyze(body: Analysis):
    current = camera.snapshot()
    with reference_lock:
        if not (DATA / 'reference.png').exists():
            raise HTTPException(409, 'Zuerst ein Referenzbild speichern')
        reference = cv2.imread(str(DATA / 'reference.png'))
        if reference is None:
            raise HTTPException(409, 'Referenz beschädigt: bitte neu aufnehmen')
        region = Region(**json.loads((DATA / 'reference.json').read_text()))
    result = compare(current, reference, region, body.pixel_threshold)
    return {**result, 'matches_reference': result['mean_difference'] <= body.max_difference,
            'max_difference': body.max_difference, 'region': region, 'demo': DEMO,
            'note': 'Optischer Grauwertvergleich; konstante Beleuchtung und feste Kameraposition erforderlich.'}


def openapi():
    if not app.openapi_schema:
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        schema.setdefault('components', {})['securitySchemes'] = {
            'BearerAuth': {'type': 'http', 'scheme': 'bearer', 'description': 'API_TOKEN aus Balena oder api-token.txt'}}
        for path, operations in schema['paths'].items():
            if path.startswith('/api/') and path != '/api/login':
                for operation in operations.values():
                    operation['security'] = [{'BearerAuth': []}]
        app.openapi_schema = schema
    return app.openapi_schema


app.openapi = openapi
app.mount('/', StaticFiles(directory=Path(__file__).parent / 'static', html=True), name='ui')
