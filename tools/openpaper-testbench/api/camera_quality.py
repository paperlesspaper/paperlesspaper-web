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


def native_size(device, fallback):
    try:
        result = subprocess.run(['v4l2-ctl', '-d', device, '--list-formats-ext'],
                                capture_output=True, text=True, timeout=5, check=True)
        sizes = mjpeg_sizes(result.stdout)
        if sizes:
            return sizes[0], None
        return fallback, 'Keine MJPEG-Auflösungen gemeldet; konfigurierte Auflösung verwendet'
    except (OSError, subprocess.SubprocessError):
        return fallback, 'Maximale Kameraauflösung konnte nicht ermittelt werden'


def preview_image(frame, quality):
    if quality == 'standard':
        h, w = frame.shape[:2]
        scale = min(1, 1280/max(w,h), 720/min(w,h))
        if scale < 1:
            return cv2.resize(frame, (round(w*scale), round(h*scale)), interpolation=cv2.INTER_AREA)
    return frame
