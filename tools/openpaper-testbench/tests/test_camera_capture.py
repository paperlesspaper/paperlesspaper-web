from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import camera_capture as module
from camera_capture import Camera
import numpy as np
import pytest
from fastapi import HTTPException
from rig import Point


def wait_for(predicate, timeout=3):
    deadline = time.monotonic() + timeout
    while not predicate():
        assert time.monotonic() < deadline, 'Timed out waiting for capture worker'
        time.sleep(.01)


@pytest.fixture
def capture(tmp_path, monkeypatch):
    monkeypatch.setenv('DEMO_MODE', '0')
    monkeypatch.setenv('CAMERA_FPS', '2')
    camera = Camera('/dev/fake', tmp_path/'controls.json')
    opened = []
    class Capture:
        def __init__(self, *args):
            self.values = {}
            self.released = False
            self.reads = []
            opened.append(self)
        def set(self, prop, value):
            self.values[prop] = value
            return True
        def get(self, prop): return 30  # Driver ignores requested FPS.
        def read(self):
            self.reads.append(time.monotonic())
            return True, np.full((self.values[module.cv2.CAP_PROP_FRAME_HEIGHT],
                                 self.values[module.cv2.CAP_PROP_FRAME_WIDTH],3), 100, np.uint8)
        def release(self): self.released = True
    monkeypatch.setattr(module.cv2, 'VideoCapture', Capture)
    monkeypatch.setattr(module, 'capture_sizes', lambda *args: ((160,90),(80,45),None))
    monkeypatch.setattr(camera.controls, 'initialize', lambda: None)
    worker = threading.Thread(target=camera.run)
    worker.start()
    try:
        yield camera, opened
    finally:
        camera.stop.set()
        camera.wake.set()
        worker.join(3)
        assert not worker.is_alive()


def test_status_stays_idle_preview_wakes_and_idle_releases_usb(capture):
    camera, opened = capture
    for _ in range(3):
        assert camera.status()['paused']
    assert opened == []
    assert camera.snapshot(quality='standard').shape == (45,80,3)
    assert camera.status()['reported_fps'] == 30 and camera.status()['fps_note']
    with camera.lock:
        camera.demand_until = 0
    wait_for(lambda: camera.status()['paused'])
    assert opened[0].released
    assert camera.frame is None
    assert camera.snapshot(quality='standard').shape == (45,80,3)
    assert len(opened) == 2


def test_full_resolution_photo_and_night_frames_then_preview(capture):
    camera, opened = capture
    assert camera.snapshot(quality='standard').shape == (45,80,3)
    assert camera.snapshot().shape == (90,160,3)
    assert opened[0].released
    sequence = camera.sequence
    frame, next_sequence = camera.next_frame(sequence)
    assert frame.shape == (90,160,3) and next_sequence > sequence
    assert len(opened) == 2  # Night capture retains the full-resolution stream.
    with camera.lock:
        camera.high_until = 0
    wait_for(lambda: camera.frame_quality == 'standard')
    assert camera.snapshot(quality='standard').shape == (45,80,3)
    assert opened[1].released and len(opened) == 3


def test_capture_processing_is_limited_even_when_driver_ignores_fps(capture):
    camera, opened = capture
    camera.snapshot(quality='standard')
    wait_for(lambda: len(opened[0].reads) >= 3)
    intervals = np.diff(opened[0].reads)
    assert np.all(intervals >= .45)


def test_failed_and_stopped_capture_never_returns_cached_frame(capture, monkeypatch):
    camera, opened = capture
    camera.snapshot(quality='standard')
    monkeypatch.setattr(opened[0], 'read', lambda: (False,None))
    wait_for(lambda: camera.error is not None)
    with pytest.raises(HTTPException) as exc:
        camera.frame_for('standard', timeout=.05)
    assert exc.value.status_code == 503
    camera.stop.set()
    with pytest.raises(HTTPException):
        camera.snapshot()


def test_shared_jpeg_cache_tracks_frames_crop_rotation_and_calibration(tmp_path, monkeypatch):
    camera = Camera('/dev/fake', tmp_path/'controls.json')
    frame = np.full((90,160,3),100,np.uint8)
    sequence = [1]
    monkeypatch.setattr(camera, 'frame_for', lambda *args:(frame,sequence[0]))
    calls = []
    def encode(image, quality):
        calls.append((image.shape,quality))
        time.sleep(.01)
        return str(len(calls)).encode()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _:camera.preview_jpeg(encode), range(4)))
    assert results == [b'1'] * 4 and len(calls) == 1
    camera.preview_jpeg(encode, rotation=90)
    assert calls[-1][0] == (160,90,3)
    corners = [Point(x=0,y=0),Point(x=.5,y=0),Point(x=.5,y=.5),Point(x=0,y=.5)]
    camera.preview_jpeg(encode, corners=corners)
    camera.preview_jpeg(encode, quality='high')
    assert len(calls) == 4 and calls[-1][1] == 98
    camera.gray.store({'enabled':True,'gains_bgr':[1,1,1]})
    camera.preview_jpeg(encode)
    assert len(calls) == 5
    sequence[0] += 1
    camera.preview_jpeg(encode)
    assert len(calls) == 6 and len(camera.render_cache) == 1
