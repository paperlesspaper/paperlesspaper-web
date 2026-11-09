"""Discover native MJPEG sizes; preview scaling never changes photo resolution."""
import re
import subprocess
import cv2


def mjpeg_sizes(text):
    sizes, mjpeg = set(), False
    for line in text.splitlines():
        fmt = re.search(r"\[\d+\]: '(.{4})'", line)
        if fmt:
            mjpeg = fmt[1] == 'MJPG'
        size = re.search(r'Size: Discrete (\d+)x(\d+)', line)
        if mjpeg and size:
            w, h = map(int, size.groups())
            if w > 0 and h > 0:
                sizes.add((w, h))
    return sorted(sizes, key=lambda s: s[0]*s[1], reverse=True)


def capture_sizes(device, fallback, preview_limit=(1280, 720)):
    try:
        result = subprocess.run(['v4l2-ctl', '-d', device, '--list-formats-ext'],
                                capture_output=True, text=True, timeout=5, check=True)
        sizes = mjpeg_sizes(result.stdout)
        if sizes:
            # Keep the native aspect ratio so preview corners also fit photos.
            native = sizes[0]
            limit_long, limit_short = sorted(preview_limit, reverse=True)
            candidates = [s for s in sizes if max(s) <= limit_long and min(s) <= limit_short
                          and abs(s[0]/s[1] - native[0]/native[1]) < .01]
            preview = candidates[0] if candidates else native
            note = None if candidates else 'Keine kleinere MJPEG-Auflösung mit gleichem Seitenverhältnis verfügbar'
            return native, preview, note
        return fallback, fallback, 'Keine MJPEG-Auflösungen gemeldet; konfigurierte Auflösung verwendet'
    except (OSError, subprocess.SubprocessError):
        return fallback, fallback, 'Maximale Kameraauflösung konnte nicht ermittelt werden'


def native_size(device, fallback):
    native, _, note = capture_sizes(device, fallback)
    return native, note


def preview_image(frame, quality):
    if quality == 'standard':
        h, w = frame.shape[:2]
        scale = min(1, 1280/max(w,h), 720/min(w,h))
        if scale < 1:
            return cv2.resize(frame, (round(w*scale), round(h*scale)), interpolation=cv2.INTER_AREA)
    return frame
