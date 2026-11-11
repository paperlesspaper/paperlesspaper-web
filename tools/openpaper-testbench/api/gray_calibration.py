"""Per-camera gray-card correction in linear sRGB, persisted independently of V4L2."""
import json
from pathlib import Path
import threading

import cv2
import numpy as np
from fastapi import HTTPException


def linear(value):
    value = np.asarray(value, dtype=np.float64) / 255
    return np.where(value <= .04045, value / 12.92, ((value + .055) / 1.055) ** 2.4)


def encoded(value):
    value = np.clip(value, 0, 1)
    return np.where(value <= .0031308, value * 12.92, 1.055 * value ** (1 / 2.4) - .055) * 255


class GrayCalibration:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.RLock()
        self.data = {'enabled': False}
        self.lut = None
        try:
            data = json.loads(self.path.read_text())
            gains = np.asarray(data.get('gains_bgr', []), dtype=float)
            if data.get('enabled') and gains.shape == (3,) and np.all(np.isfinite(gains)) and np.all((gains > 0) & (gains <= 16)):
                self.data = data
                self.lut = self.make_lut(gains)
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    @staticmethod
    def make_lut(gains):
        return np.rint(encoded(linear(np.arange(256))[:, None] * gains)).astype(np.uint8).reshape(256, 1, 3)

    def status(self):
        with self.lock:
            return dict(self.data)

    def store(self, data):
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_suffix('.tmp')
            temporary.write_text(json.dumps(data))
            temporary.replace(self.path)
            self.data = data
            self.lut = self.make_lut(data['gains_bgr']) if data['enabled'] else None
            return self.status()

    def reset(self):
        return self.store({'enabled': False})

    def calibrate(self, patch, target, region):
        pixels = patch.reshape(-1, 3)
        # Clipping destroys the channel ratios; don't silently calibrate from it.
        if np.mean(np.any(pixels >= 250, axis=1)) > .02:
            raise HTTPException(422, 'Graufläche überbelichtet. Belichtung reduzieren oder eine andere Fläche wählen.')
        means = linear(pixels).mean(axis=0)
        if np.min(means) < linear(12):
            raise HTTPException(422, 'Graufläche zu dunkel. Beleuchtung oder Belichtung erhöhen.')
        gains = linear(target) / means
        if np.max(gains) > 16:
            raise HTTPException(422, 'Korrektur zu stark. Belichtung näher an die gewünschte Helligkeit einstellen.')
        return self.store({'enabled': True, 'target': target, 'region': region,
                           'sample_rgb': np.rint(encoded(means[::-1])).astype(int).tolist(),
                           'gains_bgr': gains.tolist()})

    def apply(self, image):
        with self.lock:
            lut = self.lut
        return cv2.LUT(image, lut) if lut is not None else image
