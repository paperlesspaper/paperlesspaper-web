import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import numpy as np
import pytest
from fastapi import HTTPException
from gray_calibration import GrayCalibration


def test_neutralizes_cast_and_brightness_and_persists(tmp_path):
    path = tmp_path / 'camera.gray.json'
    calibration = GrayCalibration(path)
    image = np.full((20, 30, 3), (90, 120, 150), np.uint8)
    assert np.array_equal(calibration.apply(image), image)
    result = calibration.calibrate(image, 118, {'x': .1})
    assert result['sample_rgb'] == [150, 120, 90]
    assert np.all(calibration.apply(image) == 118)
    assert np.all(GrayCalibration(path).apply(image) == 118)
    assert np.all(image == (90, 120, 150)), 'Never mutate the camera buffer'
    calibration.reset()
    assert not GrayCalibration(path).status()['enabled']
    assert np.array_equal(calibration.apply(image), image)


@pytest.mark.parametrize('color', [(0, 0, 0), (1, 90, 100), (255, 120, 120), (249, 255, 255)])
def test_unusable_gray_does_not_replace_existing_calibration(tmp_path, color):
    calibration = GrayCalibration(tmp_path / 'gray.json')
    previous = calibration.calibrate(np.full((10, 10, 3), 100, np.uint8), 118, {})
    with pytest.raises(HTTPException):
        calibration.calibrate(np.full((10, 10, 3), color, np.uint8), 118, {})
    assert calibration.status() == previous


def test_pixel_values_clip_without_wrapping_and_cameras_are_independent(tmp_path):
    a, b = [GrayCalibration(tmp_path / name) for name in ('a.json', 'b.json')]
    a.calibrate(np.full((10, 10, 3), 70, np.uint8), 118, {})
    white = np.full((10, 10, 3), 255, np.uint8)
    assert np.all(a.apply(white) == 255)
    assert not b.status()['enabled']
