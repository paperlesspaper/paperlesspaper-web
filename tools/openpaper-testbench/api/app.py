"""OpenPaper test rig. One process owns the camera and GPIO line."""
import asyncio
from contextlib import asynccontextmanager, contextmanager
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
from urllib.parse import urlsplit, quote

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
from auth import WebAuth, COOKIE, SESSION_SECONDS, REMEMBER_SECONDS
from camera_capture import Camera
from night_capture import NightCapture
from rig import Rig, RigConfig, inventory, rectify, orient
from light import Light

DATA = Path(os.getenv('DATA_DIR', '/data'))
DATA.mkdir(parents=True, exist_ok=True)
PHOTOS = DATA / 'photos'
PHOTOS.mkdir(exist_ok=True)
START = time.monotonic()
TOKEN = os.getenv('API_TOKEN', '')
web_auth = WebAuth(os.getenv('WEB_PASSWORD_HASH', ''), DATA / 'web-sessions.json')
DEMO = os.getenv('DEMO_MODE', '0') == '1'
MAX_PHOTOS = max(1, int(os.getenv('MAX_PHOTOS', '200')))


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
rig = Rig(DATA, Camera, DEMO)
light = Light(DATA / "light.json", lambda: rig.config.light_device, web_auth.valid, DEMO)


@asynccontextmanager
async def lifespan(app):
    button.open()
    if not any(f.serial for f in rig.snapshot().frames):
        serial_monitor.start()
    light.start()
    worker = threading.Thread(target=camera.run, daemon=True)
    camera.worker = worker
    if not any(f.camera for f in rig.snapshot().frames):
        worker.start()
    yield
    await asyncio.to_thread(night_capture.close)
    await asyncio.to_thread(light.close)
    await asyncio.to_thread(rig.close)
    camera.stop.set()
    await asyncio.to_thread(serial_monitor.close)
    await asyncio.to_thread(button.close)
    if worker.ident is not None:
        await asyncio.to_thread(worker.join, 5)


app = FastAPI(title='OpenPaper Testbench API', version='1.8.7', lifespan=lifespan)


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
    open_paths = ('/login.html', '/login.css', '/login.js', '/paperlesspaper-logo.svg', '/favicon.svg', '/api/login')
    if request.url.path not in open_paths and not authorized(request):
        if request.url.path.startswith('/api/') or request.url.path in ('/healthz', '/openapi.json'):
            response = JSONResponse({'detail': 'Anmeldung erforderlich'}, status_code=401)
        else:
            target = request.url.path + ('?' + request.url.query if request.url.query else '')
            response = RedirectResponse('/login.html' + ('?next=' + quote(target, safe='') if target != '/' else ''), status_code=303)
        return protected_headers(response)
    return protected_headers(await call_next(request))


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    remember: bool = False


@app.post('/api/login')
def login(body: Login, request: Request):
    origin = request.headers.get('origin')
    if public_request(request) and origin and urlsplit(origin).scheme != 'https':
        raise HTTPException(403, 'Anmeldung nur über HTTPS')
    # The Balena proxy is shared. Do not trust client-supplied forwarding headers
    # for rate-limit keys; public attempts share one bucket.
    source = 'public' if public_request(request) else (request.client.host if request.client else 'unknown')
    token = web_auth.login(body.password, source, remember=body.remember)
    duration = REMEMBER_SECONDS if body.remember else SESSION_SECONDS
    response = JSONResponse({'ok': True, 'expires_in': duration})
    response.set_cookie(COOKIE, token, httponly=True, secure=public_request(request) or request.url.scheme == 'https',
                        samesite='lax', max_age=duration if body.remember else None, path='/')
    response.delete_cookie('testbench', path='/')  # Retire the former raw API-token cookie.
    return response


@app.post('/api/logout')
def logout(request: Request):
    web_auth.logout(request.cookies.get(COOKIE, ''))
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE, httponly=True, secure=public_request(request) or request.url.scheme == 'https',
                           samesite='lax', path='/')
    return response


@app.get('/api/session')
def session_status():
    # Protected by the middleware; avoids starting hardware on the login page.
    return {'ok': True}


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
def status(frame_id: str | None = None, detail: bool = False):
    disk = shutil.disk_usage(DATA)
    temperature = read_text('/sys/class/thermal/thermal_zone0/temp', '')
    return {'name': 'OpenPaper Testbench', 'demo': DEMO, 'uptime_seconds': int(time.monotonic() - START),
            'hostname': socket.gethostname(), 'device_uuid': os.getenv('BALENA_DEVICE_UUID'), 'network_urls': network_urls(),
            'model': read_text('/proc/device-tree/model'),
            'temperature_c': float(temperature) / 1000 if temperature.isdigit() else None,
            'storage_free_mb': round(disk.free / 1024**2),
            'power': power_status(),
            'camera': (rig.camera(detail=True).status() if rig.snapshot().detail_camera else {'connected':False,'error':'Kamera zuordnen'}) if detail else (selected_camera(frame_id).status() if not frame_id or rig.profile(frame_id).camera else {'connected':False,'error':'Kamera zuordnen'}),
            'relay': hardware_status(lambda: selected_relay(frame_id)) if not frame_id or rig.profile(frame_id).relay else {'available':False,'error':'Relais zuordnen'},
            'serial': selected_serial(frame_id).status() if not frame_id or rig.profile(frame_id).serial else {'connected':False,'error':'UART zuordnen'},
            'button': {'enabled': button.enabled, 'available': button.enabled and (DEMO or button.line is not None),
                       'gpio': button.pin, 'pressed': button.pressed, 'count': button.count,
                       'last_press': button.last, 'error': button.error},
            'reference_available': (rig.reference_path(rig.profile(frame_id)) if frame_id else DATA / 'reference.png').exists(),
            'video_devices': sorted(glob.glob('/dev/video*')),
            'framebuffers': sorted(glob.glob('/dev/fb*')),
            'openpaper': {'telemetry': 'serial_connected' if serial_monitor.connected else 'not_connected',
                          'note': 'UART-Rohdaten unter /api/serial; Relaiszustand ohne elektrische Rückmeldung.'}}


def jpeg(frame, quality=88):
    params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    if quality == 100:
        # Preserve full colour detail in photos, including fine coloured text.
        # The camera's own MJPEG compression cannot be undone here.
        params += [cv2.IMWRITE_JPEG_SAMPLING_FACTOR, cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444]
    ok, encoded = cv2.imencode('.jpg', frame, params)
    if not ok:
        raise HTTPException(500, 'JPEG konnte nicht erstellt werden')
    return encoded.tobytes()


@app.get('/api/camera.jpg')
def camera_image(frame_id: str | None = None, detail: bool = False, cropped: bool = False, quality: Literal['standard', 'high'] = 'standard'):
    profile = None if detail else selected_profile(frame_id)
    camera = rig.camera(detail=True) if detail else (rig.camera_key(profile.camera) if profile else selected_camera())
    data = camera.preview_jpeg(jpeg, quality, profile.rotation if profile else 0,
                               profile.corners if cropped and frame_id else None)
    return Response(data, media_type='image/jpeg', headers={'Cache-Control': 'no-store'})


@app.get('/api/stream.mjpg')
async def stream(frame_id: str | None = None):
    profile = selected_profile(frame_id)
    camera = rig.camera_key(profile.camera) if profile else selected_camera()
    await asyncio.to_thread(camera.frame_for, 'standard')  # Wake before sending stream headers.
    async def frames():
        while True:
            try:
                data = await asyncio.to_thread(camera.preview_jpeg, jpeg, 'standard', profile.rotation if profile else 0)
            except HTTPException:
                return
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + data + b'\r\n'
            await asyncio.sleep(1 / camera.fps)
    return StreamingResponse(frames(), media_type='multipart/x-mixed-replace; boundary=frame')


photo_lock = threading.Lock()


def save_photo(frame):
    data = jpeg(frame, 100)
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(4) + '.jpg'
    with photo_lock:
        (PHOTOS / name).write_bytes(data)
        files = sorted(PHOTOS.glob('*.jpg'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in files[MAX_PHOTOS:]:
            old.unlink(missing_ok=True)
    return {'id': name, 'url': f'/api/photos/{name}', 'bytes': len(data), 'demo': DEMO, 'resolution': [frame.shape[1], frame.shape[0]], 'jpeg_quality': 100}


night_capture = NightCapture(camera, camera.controls, lambda image: save_photo(camera.gray.apply(image)))


@app.post('/api/photos', status_code=201)
def take_photo(frame_id: str | None = None, detail: bool = False, cropped: bool = False):
    if cropped and (not frame_id or detail):
        raise HTTPException(422, 'Entzerrtes Foto benötigt einen Rahmen ohne Detailkamera')
    profile = None if detail else selected_profile(frame_id)
    camera = rig.camera(detail=True) if detail else (rig.camera_key(profile.camera) if profile else selected_camera())
    frame = orient(camera.snapshot(), profile.rotation if profile else 0)
    if cropped:
        frame = rectify(frame, profile.corners)
    return {**save_photo(frame), 'frame_id':frame_id, 'cropped':cropped, 'detail':detail}


class CameraSettings(BaseModel):
    values: dict[str, int] = Field(min_length=1, max_length=32)


class NightRequest(BaseModel):
    seconds: int = Field(default=10, ge=2, le=60)


@app.get('/api/camera/controls')
def camera_controls(frame_id: str | None = None):
    camera = selected_camera(frame_id)
    return camera.controls.info()


@app.post('/api/camera/controls')
def set_camera_controls(body: CameraSettings, frame_id: str | None = None):
    camera = selected_camera(frame_id)
    return camera.controls.apply(body.values)


@app.post('/api/camera/restore')
def restore_camera_controls(frame_id: str | None = None):
    camera = selected_camera(frame_id)
    return camera.controls.restore()


@app.post('/api/camera/night-profile')
def camera_night_profile(frame_id: str | None = None):
    camera = selected_camera(frame_id)
    with camera.controls.exclusive():
        return camera.controls.apply(camera.controls.night_values())


@app.post('/api/camera/night', status_code=202)
def start_night_photo(body: NightRequest, frame_id: str | None = None):
    return selected_night(frame_id).start(body.seconds)


@app.get('/api/camera/night')
def night_photo_status(frame_id: str | None = None):
    return selected_night(frame_id).status()


@app.post('/api/camera/night/cancel')
def cancel_night_photo(frame_id: str | None = None):
    return selected_night(frame_id).cancel()


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
def frame_power(body: PowerCommand, frame_id: str | None = None):
    with relay_action(frame_id) as device:
        return device.power(body.on)


@app.post('/api/reset')
def frame_reset(body: ResetCommand, frame_id: str | None = None):
    if body.count == 6 and not body.confirm_data_loss:
        raise HTTPException(422, '6× Reset kann WLAN und Aktivierung löschen; confirm_data_loss=true erforderlich')
    with relay_action(frame_id) as device:
        return device.reset(body.count)


@app.get('/api/serial')
def serial_output(after: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=2000), frame_id: str | None = None):
    return selected_serial(frame_id).read(after, limit)


@app.get('/api/serial.txt')
def serial_text(frame_id: str | None = None):
    lines = selected_serial(frame_id).read(0, 2000)['lines']
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


class GrayRequest(BaseModel):
    region: Region
    target: int = Field(default=118, ge=32, le=224)


@app.get('/api/camera/gray-calibration')
def gray_calibration(frame_id: str | None = None):
    return selected_camera(frame_id).gray.status()


@app.post('/api/camera/gray-calibration')
def calibrate_gray(body: GrayRequest, frame_id: str | None = None):
    with rig.lock:
        profile = selected_profile(frame_id)
        cam = selected_camera(frame_id)
        with cam.controls.exclusive():
            image = orient(cam.snapshot(raw=True), profile.rotation if profile else 0)
            result = cam.gray.calibrate(crop(image, body.region), body.target, body.region.model_dump())
            invalidate_gray_references(cam)
            return result


@app.post('/api/camera/gray-calibration/reset')
def reset_gray(frame_id: str | None = None):
    with rig.lock:
        cam = selected_camera(frame_id)
        with cam.controls.exclusive():
            result = cam.gray.reset()
            invalidate_gray_references(cam)
            return result


def invalidate_gray_references(cam):
    # Previous reference pixels used a different color transform.
    with reference_lock:
        for profile in rig.snapshot().frames:
            if profile.camera == cam.device:
                for path in DATA.glob(f'reference-{profile.id}-*.png'):
                    path.unlink(missing_ok=True)
        if cam is selected_camera():
            (DATA / 'reference.png').unlink(missing_ok=True)


@app.post('/api/reference')
def save_reference(body: Reference, frame_id: str | None = None):
    profile = selected_profile(frame_id)
    frame = orient((rig.camera_key(profile.camera) if profile else selected_camera()).snapshot(), profile.rotation if profile else 0)
    if frame_id:
        frame = rectify(frame, profile.corners)
        with reference_lock:
            ok, png = cv2.imencode(".png", frame)
            if not ok: raise HTTPException(500, "Referenz konnte nicht gespeichert werden")
            path = rig.reference_path(profile)
            temp = path.with_suffix(".tmp")
            temp.write_bytes(png.tobytes())
            temp.replace(path)
        return {"saved":True,"frame_id":frame_id,"demo":DEMO}
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
def analyze(body: Analysis, frame_id: str | None = None):
    profile = selected_profile(frame_id)
    current = orient((rig.camera_key(profile.camera) if profile else selected_camera()).snapshot(), profile.rotation if profile else 0)
    if frame_id:
        current = rectify(current,profile.corners)
        with reference_lock:
            reference = cv2.imread(str(rig.reference_path(profile)))
        if reference is None: raise HTTPException(409,"Zuerst eine Referenz für diesen Rahmen und Ausschnitt aufnehmen")
        result = compare(current,reference,Region(),body.pixel_threshold)
        return {**result,"matches_reference":result["mean_difference"] <= body.max_difference,"frame_id":frame_id}
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


def selected_profile(frame_id=None):
    if frame_id:
        return rig.profile(frame_id)
    first = rig.snapshot().frames[0]
    return first if first.camera else None


def selected_camera(frame_id=None):
    if frame_id: return rig.camera(frame_id)
    first = rig.snapshot().frames[0]
    return rig.camera_key(first.camera) if first.camera else camera


def hardware_status(factory):
    try: return factory().status()
    except HTTPException as exc: return {'available':False,'connected':False,'error':exc.detail}


def selected_relay(frame_id=None):
    if frame_id:
        return rig.relay(frame_id)
    first = rig.snapshot().frames[0]
    if first.relay: return rig.relay(first.id)
    if any(f.relay for f in rig.snapshot().frames) or rig.snapshot().light_device:
        raise HTTPException(409, 'Rahmen explizit auswählen')
    return relay


@contextmanager
def relay_action(frame_id):
    with rig.lock:
        device = selected_relay(frame_id)
        rig.active_actions += 1
    try:
        yield device
    finally:
        with rig.lock:
            rig.active_actions -= 1


def selected_serial(frame_id=None):
    if frame_id: return rig.serial(frame_id)
    first = rig.snapshot().frames[0]
    return rig.serial(first.id) if first.serial else serial_monitor


def selected_night(frame_id=None):
    if not frame_id:
        first = rig.snapshot().frames[0]
        if not first.camera: return night_capture
        frame_id = first.id
    cam = rig.camera(frame_id)
    with rig.lock:
        if cam.device not in rig.nights:
            rig.nights[cam.device] = NightCapture(cam,cam.controls,lambda image: save_photo(orient(cam.gray.apply(image), next((f.rotation for f in rig.snapshot().frames if f.camera == cam.device), 0))))
        return rig.nights[cam.device]


@app.get('/api/rig')
def rig_settings():
    return rig.snapshot()


@app.get('/api/devices')
def devices():
    return inventory(DEMO)


@app.post('/api/rig')
def save_rig(body: RigConfig):
    # Stop legacy owners before creating explicitly assigned device owners.
    with rig.lock:
        if rig.active_actions or any(r.lock.locked() for r in rig.relays.values()) or relay.lock.locked():
            raise HTTPException(409, 'Relaisaktion läuft; danach erneut speichern')
        result = rig.save(body)
        if any(f.camera for f in result.frames):
            camera.stop.set()
            if getattr(camera,"worker",None) and camera.worker.ident is not None:
                camera.worker.join(5)
        if any(f.serial for f in result.frames):
            serial_monitor.close()
        return result


class Presence(BaseModel):
    client_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{16,80}$')
    visible: bool


class LightSettings(BaseModel):
    mode: Literal['auto', 'on', 'off'] | None = None
    enabled: bool = True
    brightness: int = Field(default=100,ge=1,le=100)
    kelvin: int = Field(ge=2900,le=7000)


@app.get('/api/light')
def light_status():
    return light.status()


@app.post('/api/light')
def light_settings(body: LightSettings):
    return light.configure(body.model_dump())


@app.post('/api/ui/presence')
def ui_presence(body: Presence, request: Request):
    return light.heartbeat(body.client_id,body.visible,request.cookies.get(COOKIE))


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


@app.get('/', include_in_schema=False)
def camera_home():
    return RedirectResponse('/cameras/' + rig.snapshot().frames[0].id, status_code=303)


@app.get('/settings', include_in_schema=False)
@app.get('/cameras/detail', include_in_schema=False)
def dashboard():
    return FileResponse(Path(__file__).parent / 'static' / 'index.html')


@app.get('/cameras/{frame_id}', include_in_schema=False)
def camera_page(frame_id: str):
    rig.profile(frame_id)  # Unknown bookmarks must not silently show another camera.
    return dashboard()


app.mount('/', StaticFiles(directory=Path(__file__).parent / 'static', html=True), name='ui')
