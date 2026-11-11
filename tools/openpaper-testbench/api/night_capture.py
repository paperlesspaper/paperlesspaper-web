"""Bounded, asynchronous frame averaging; this is not a bulb exposure."""
import threading
import time
import uuid

import numpy as np
from fastapi import HTTPException


class NightCapture:
    def __init__(self, camera, controls, save_photo):
        self.camera, self.controls, self.save_photo = camera, controls, save_photo
        self.lock = threading.Lock()
        self.cancel_event = threading.Event()
        self.worker = None
        self.job = {'status': 'idle'}

    def status(self):
        with self.lock:
            return dict(self.job)

    def update(self, **values):
        with self.lock:
            self.job.update(values)

    def start(self, seconds):
        with self.lock:
            if self.worker and self.worker.is_alive():
                raise HTTPException(409, 'Nachtaufnahme läuft bereits')
            self.camera.snapshot()  # Fail early if unplugged.
            self.cancel_event.clear()
            self.job = {'id': uuid.uuid4().hex, 'status': 'starting', 'seconds': seconds,
                        'frames': 0, 'elapsed_seconds': 0, 'method': 'frame_average'}
            self.worker = threading.Thread(target=self.run, args=(seconds,), daemon=True)
            self.worker.start()
            return dict(self.job)

    def cancel(self):
        self.cancel_event.set()
        return self.status()

    def close(self):
        self.cancel_event.set()
        if self.worker:
            self.worker.join(12)

    def run(self, seconds):
        before = None
        result = None
        outcome = 'failed'
        error = None
        try:
            with self.controls.exclusive():
                before = {k: c['value'] for k, c in self.controls.read().items()
                          if c['value'] is not None and not c['read_only']}
                try:
                    values = self.controls.night_values()
                    self.controls.apply(values, persist=False)
                    self.update(status='settling', native_exposure_ms=values['exposure_time_absolute'] / 10)
                    if self.cancel_event.wait(2):
                        outcome = 'cancelled'
                    else:
                        start = time.monotonic()
                        sequence = self.camera.sequence
                        count, total = 0, None
                        self.update(status='capturing')
                        while time.monotonic() - start < seconds and not self.cancel_event.is_set():
                            frame, sequence = self.camera.next_frame(sequence, timeout=2)
                            if total is None:
                                total = frame.astype(np.float32)
                            else:
                                if frame.shape != total.shape:
                                    raise HTTPException(503, 'Kameraauflösung während Aufnahme geändert')
                                total += frame
                            count += 1
                            self.update(frames=count, elapsed_seconds=round(time.monotonic() - start, 1))
                            # Constant memory; sample at most five frames per second.
                            self.cancel_event.wait(.2)
                        if self.cancel_event.is_set():
                            outcome = 'cancelled'
                        elif count < 2:
                            raise HTTPException(503, 'Zu wenige frische Bilder für eine Nachtaufnahme')
                        else:
                            result = self.save_photo(np.clip(total / count, 0, 255).astype(np.uint8))
                            outcome = 'complete'
                finally:
                    self.update(status='restoring')
                    try:
                        self.controls.apply(before, persist=False)
                    except Exception as exc:
                        raise HTTPException(503, 'Kameraeinstellungen konnten nicht wiederhergestellt werden; Kamera prüfen') from exc
        except Exception as exc:
            error = str(getattr(exc, 'detail', exc))
            outcome = 'failed'
        self.update(status=outcome, result=result, error=error)
