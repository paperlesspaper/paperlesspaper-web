from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import numpy as np
from camera_quality import mjpeg_sizes, preview_image, native_size


def test_maximum_resolution_comes_from_mjpeg_not_other_formats():
    text = """
    [0]: 'MJPG' (Motion-JPEG)
      Size: Discrete 640x480
      Size: Discrete 1920x1080
      Size: Discrete 1280x720
      Size: Discrete 1920x1080
    [1]: 'YUYV'
      Size: Discrete 4096x2160
    """
    assert mjpeg_sizes(text) == [(1920,1080),(1280,720),(640,480)]


def test_preview_is_downscaled_without_modifying_capture():
    source = np.zeros((1080,1920,3),np.uint8)
    assert preview_image(source,'standard').shape == (720,1280,3)
    assert preview_image(source,'high') is source
    small = source[:480,:640]
    assert preview_image(small,'standard') is small


def test_discovery_failure_is_explicit(monkeypatch):
    def fail(*args,**kwargs): raise OSError('unplugged')
    monkeypatch.setattr('camera_quality.subprocess.run',fail)
    size, note = native_size('/dev/video0',(1920,1080))
    assert size == (1920,1080) and note


def test_portrait_standard_keeps_same_pixel_budget_as_landscape():
    portrait=np.zeros((1920,1080,3),np.uint8)
    assert preview_image(portrait,'standard').shape == (1280,720,3)
    assert preview_image(portrait,'high') is portrait
