"""Native V4L2 controls. Never turn driver-reported invalid defaults into writes."""
from contextlib import contextmanager
import json
from pathlib import Path
import re
import subprocess
import threading

from fastapi import HTTPException

LABELS = {
    'brightness': 'Helligkeit', 'contrast': 'Kontrast', 'gain': 'Verstärkung',
    'auto_exposure': 'Belichtungsautomatik', 'exposure_time_absolute': 'Belichtungszeit',
    'exposure_dynamic_framerate': 'Variable Bildrate',
    'focus_auto': 'Autofokus', 'focus_absolute': 'Manueller Fokus',
    'white_balance_automatic': 'Automatischer Weißabgleich',
    'white_balance_temperature': 'Weißabgleich · Farbtemperatur',
    'saturation': 'Sättigung', 'hue': 'Farbton', 'gamma': 'Gamma',
    'sharpness': 'Schärfe', 'backlight_compensation': 'Gegenlichtkorrektur',
    'power_line_frequency': 'Flimmerunterdrückung', 'zoom_absolute': 'Zoom',
}
ALIASES = {'exposure_auto': 'auto_exposure', 'exposure_absolute': 'exposure_time_absolute',
           'exposure_auto_priority': 'exposure_dynamic_framerate',
           'focus_automatic_continuous': 'focus_auto',
           'white_balance_temperature_auto': 'white_balance_automatic'}

DEPENDENCIES = {'exposure_time_absolute': ('auto_exposure', 1),
                'focus_absolute': ('focus_auto', 0),
                'white_balance_temperature': ('white_balance_automatic', 0)}


def parse_controls(text):
    controls = {}
    current = None
    for line in text.splitlines():
        match = re.match(r'\s*(\w+)\s+0x[0-9a-f]+\s+\((int|bool|menu)\)\s*:\s*(.*)', line)
        if match:
            native, kind, attrs = match.groups()
            name = ALIASES.get(native, native)
            current = None
            if name not in LABELS:
                continue
            numbers = {k: int(v) for k, v in re.findall(r'(min|max|step|default|value)=(-?\d+)', attrs)}
            minimum, maximum = numbers.get('min', 0), numbers.get('max', 1)
            default = numbers.get('default')
            current = {'name': name, 'native_name': native, 'label': LABELS[name], 'type': kind,
                       'min': minimum, 'max': maximum, 'step': numbers.get('step', 1),
                       'value': numbers.get('value'), 'default': default if default is not None and minimum <= default <= maximum else None,
                       'inactive': 'inactive' in attrs, 'read_only': 'read-only' in attrs or 'disabled' in attrs,
                       'choices': {}}
            if name in DEPENDENCIES:
                auto, manual = DEPENDENCIES[name]
                current['manual_when'] = {'control': auto, 'value': manual}
            if name == 'exposure_time_absolute':
                current['unit'] = '100 us'
                current['min_ms'], current['max_ms'] = minimum / 10, maximum / 10
            controls[name] = current
        elif current and current['type'] == 'menu':
            item = re.match(r'\s+(\d+):\s+(.+)', line)
            if item:
                current['choices'][int(item[1])] = item[2]
    return controls


class CameraControls:
    def __init__(self, device, settings_file):
        self.device, self.settings_file = device, Path(settings_file)
        self.lock = threading.RLock()
        self.baseline, self.desired = {}, {}
        self.error = None
        try:
            data = json.loads(self.settings_file.read_text())
            self.baseline = self.clean(data.get('baseline', {}))
            self.desired = self.clean(data.get('desired', {}))
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    @staticmethod
    def clean(values):
        return {k: v for k, v in values.items() if k in LABELS and type(v) is int}

    @contextmanager
    def exclusive(self):
        if not self.lock.acquire(blocking=False):
            raise HTTPException(409, 'Kameraeinstellungen durch eine Aufnahme belegt')
        try:
            yield
        finally:
            self.lock.release()

    def command(self, arg):
        if self.device.startswith('supercamera:'):
            raise HTTPException(503, 'Das Endoskop unterstützt keine nativen V4L2-Regler')
        try:
            result = subprocess.run(['v4l2-ctl', '-d', self.device, arg], capture_output=True, text=True, timeout=5)
            if result.returncode:
                raise HTTPException(503, (result.stderr or result.stdout).strip()[:400] or 'Kamera nicht erreichbar')
            return result.stdout
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise HTTPException(503, 'Native Kameraeinstellungen nicht erreichbar') from exc

    def read(self):
        output = self.command('--list-ctrls-menus')
        controls = parse_controls(output)
        # v4l2-ctl can exit successfully despite failed individual UVC reads.
        # A stalled camera may also report zero outside its advertised range.
        # Never present those as current settings or persist them as a baseline.
        if re.search(r'error\s+\d+\s+getting\s+(?:ext_)?ctrl', output, re.IGNORECASE) or any(
            c['value'] is None or not c['min'] <= c['value'] <= c['max']
            or (c['type'] == 'menu' and c['value'] not in c['choices'])
            for c in controls.values()
        ):
            raise HTTPException(503, 'Kamera liefert unvollständige oder ungültige Reglerwerte. USB-Verbindung prüfen.')
        if not controls:
            raise HTTPException(503, 'Keine unterstützten nativen Kameraeinstellungen gefunden')
        return controls

    def save(self):
        self.settings_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.settings_file.with_suffix('.tmp')
        tmp.write_text(json.dumps({'baseline': self.baseline, 'desired': self.desired}))
        tmp.replace(self.settings_file)

    def initialize(self):
        with self.exclusive():
            controls = self.read()
            missing = {k: c['value'] for k, c in controls.items() if k not in self.baseline and c['value'] is not None and not c['read_only']}
            if missing:
                self.baseline.update(missing)
                self.save()
            self.apply({**self.baseline, **self.desired}, persist=False)
            self.error = None

    def info(self):
        with self.exclusive():
            controls = self.read()
            exposure = controls.get('exposure_time_absolute')
            mode = controls.get('auto_exposure', {})
            return {'controls': list(controls.values()), 'max_exposure_ms': exposure['max_ms'] if exposure else None,
                    'night_supported': bool(exposure and 1 in mode.get('choices', {})),
                    'saved': self.desired, 'error': self.error,
                    'focus_supported': 'focus_absolute' in controls, 'autofocus_supported': 'focus_auto' in controls,
                    'note': 'Belichtungsgrenzen laut Treiber; tatsächliche Belichtung kann durch die Bildrate begrenzt sein.'}

    def apply(self, values, persist=True):
        with self.exclusive():
            values = dict(values)
            controls = self.read()
            for manual, (auto, off) in DEPENDENCIES.items():
                if manual in values and auto not in values and auto in controls:
                    values[auto] = off
            if not values:
                raise HTTPException(422, 'Mindestens einen Wert angeben')
            for name, value in values.items():
                c = controls.get(name)
                if c is None or c['read_only'] or type(value) is not int:
                    raise HTTPException(422, f'Nicht unterstützter Kameraregler: {name}')
                if not c['min'] <= value <= c['max'] or (value - c['min']) % c['step']:
                    raise HTTPException(422, f'{c["label"]}: erlaubt {c["min"]} bis {c["max"]}, Schritt {c["step"]}')
                if c['type'] == 'menu' and value not in c['choices']:
                    raise HTTPException(422, f'Ungültige Auswahl für {c["label"]}')
            before = {k: c['value'] for k, c in controls.items() if c['value'] is not None and not c['read_only']}
            old_desired = dict(self.desired)
            try:
                self.write_values(values, controls)
                after = self.read()
                if any(after[k]['value'] != v for k, v in values.items()
                       if k not in DEPENDENCIES or DEPENDENCIES[k][0] not in after
                       or after[DEPENDENCIES[k][0]]['value'] == DEPENDENCIES[k][1]):
                    raise HTTPException(503, 'Kamera hat die angeforderten Werte nicht übernommen')
                if persist:
                    self.desired.update(values)
                    self.save()
                self.error = None
                return self.info()
            except Exception:
                self.desired = old_desired
                try:
                    self.write_values(before, self.read())
                except Exception:
                    self.error = 'Kameraeinstellungen nach Fehler nicht vollständig wiederhergestellt'
                raise

    def write_values(self, values, controls):
        # Manual lens, exposure and white balance writes require their auto mode off.
        def write(name, value):
            self.command(f'--set-ctrl={controls[name]["native_name"]}={value}')
        auto_controls = {auto for auto, _ in DEPENDENCIES.values()}
        for manual, (auto, off) in DEPENDENCIES.items():
            if manual in values and auto in controls:
                if auto == 'auto_exposure' and off not in controls[auto]['choices']:
                    raise HTTPException(422, 'Manuelle Belichtung nicht unterstützt')
                write(auto, off)
            elif auto in values:
                write(auto, values[auto])
        for name, value in values.items():
            if name not in auto_controls:
                write(name, value)
        for auto in auto_controls:
            if auto in values:
                write(auto, values[auto])

    def restore(self):
        if not self.baseline:
            raise HTTPException(503, 'Noch kein Rücksetzpunkt gespeichert')
        return self.apply(self.baseline)

    def night_values(self):
        controls = self.read()
        if 'exposure_time_absolute' not in controls or 1 not in controls.get('auto_exposure', {}).get('choices', {}):
            raise HTTPException(422, 'Manuelle Nachtbelichtung wird nicht unterstützt')
        values = {'auto_exposure': 1, 'exposure_time_absolute': controls['exposure_time_absolute']['max']}
        if 'gain' in controls:
            values['gain'] = controls['gain']['max']
        return values
