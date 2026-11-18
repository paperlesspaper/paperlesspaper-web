import json
import threading
from pathlib import Path
import sys
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import numpy as np
import pytest
from fastapi import HTTPException
import camera_controls as cc
import night_capture as nc

SAMPLE = '''
 brightness 0x00980900 (int) : min=-64 max=64 step=1 default=-8193 value=0
 contrast 0x00980901 (int) : min=0 max=64 step=1 default=57343 value=32
 gain 0x00980913 (int) : min=0 max=100 step=1 default=57343 value=0
 auto_exposure 0x009a0901 (menu) : min=0 max=3 default=0 value=3 (Aperture Priority Mode)
     1: Manual Mode
     3: Aperture Priority Mode
 exposure_time_absolute 0x009a0902 (int) : min=1 max=5000 step=1 default=157 value=157 flags=inactive
 exposure_dynamic_framerate 0x009a0903 (bool) : default=0 value=1
'''

@pytest.fixture
def controller(tmp_path, monkeypatch):
    c = cc.CameraControls('/dev/video0', tmp_path / 'settings.json')
    controls = cc.parse_controls(SAMPLE)
    writes = []
    def read():
        return {k: {**v, 'choices':dict(v['choices'])} for k,v in controls.items()}
    def command(arg):
        assert arg.startswith('--set-ctrl=')
        name, value = arg.removeprefix('--set-ctrl=').split('=')
        if name == 'exposure_time_absolute':
            assert controls['auto_exposure']['value'] == 1
        controls[name]['value'] = int(value)
        writes.append((name, int(value)))
        return ''
    monkeypatch.setattr(c, 'read', read)
    monkeypatch.setattr(c, 'command', command)
    c.initialize()
    writes.clear()
    return c, controls, writes


def test_native_limits_and_invalid_factory_defaults():
    c = cc.parse_controls(SAMPLE)
    assert c['brightness']['default'] is None
    assert c['contrast']['default'] is None
    assert c['exposure_time_absolute']['max_ms'] == 500
    assert c['auto_exposure']['choices'] == {1:'Manual Mode',3:'Aperture Priority Mode'}
    aliased = cc.parse_controls(SAMPLE.replace('auto_exposure ', 'exposure_auto ').replace('exposure_time_absolute ', 'exposure_absolute '))
    assert aliased['exposure_time_absolute']['native_name'] == 'exposure_absolute'


@pytest.mark.parametrize('output', [
    SAMPLE + '\nerror 32 getting ctrl White Balance Temperature\n',
    SAMPLE + '\nerror 32 getting ext_ctrl Focus, Absolute\n',
    SAMPLE.replace('value=157', 'value=0'),
    SAMPLE.replace('value=157', ''),
    SAMPLE.replace('value=3 (Aperture', 'value=2 (Aperture'),
])
def test_failed_uvc_reads_do_not_become_saved_camera_settings(tmp_path, monkeypatch, output):
    c = cc.CameraControls('/dev/video0', tmp_path / 'settings.json')
    commands = []
    def command(arg):
        commands.append(arg)
        return output
    monkeypatch.setattr(c, 'command', command)
    for action in (c.info, c.initialize, lambda: c.apply({'exposure_time_absolute':87})):
        with pytest.raises(HTTPException) as exc:
            action()
        assert exc.value.status_code == 503
    assert commands == ['--list-ctrls-menus'] * 3
    assert c.baseline == {} and c.desired == {}
    assert not c.settings_file.exists()


def test_valid_current_values_accept_invalid_factory_defaults(tmp_path, monkeypatch):
    c = cc.CameraControls('/dev/video0', tmp_path / 'settings.json')
    monkeypatch.setattr(c, 'command', lambda arg: SAMPLE)
    assert c.read()['exposure_time_absolute']['value'] == 157


def test_validation_before_writes_and_persistence(controller):
    c, controls, writes = controller
    for values in ({'brightness':65}, {'contrast':-1}, {'arbitrary_shell_command':1}, {'auto_exposure':2}):
        with pytest.raises(HTTPException) as exc: c.apply(values)
        assert exc.value.status_code == 422
    assert not writes
    c.apply({'brightness':12,'contrast':40,'exposure_time_absolute':5000})
    assert writes[0] == ('auto_exposure',1)
    assert controls['auto_exposure']['value'] == 1
    saved = json.loads(c.settings_file.read_text())
    assert saved['desired']['exposure_time_absolute'] == 5000
    assert saved['desired']['auto_exposure'] == 1
    c.restore()
    assert {k:v['value'] for k,v in controls.items()} == c.baseline


def test_failed_readback_rolls_back(controller, monkeypatch):
    c, controls, writes = controller
    original = c.command
    def ignore_contrast(arg):
        if arg == '--set-ctrl=contrast=40': return ''
        return original(arg)
    monkeypatch.setattr(c,'command',ignore_contrast)
    with pytest.raises(HTTPException): c.apply({'brightness':12,'contrast':40})
    assert {k:v['value'] for k,v in controls.items()} == c.baseline
    assert c.desired == {}


def test_busy_controls_fail_fast(controller):
    c, _, _ = controller
    locked, release = threading.Event(), threading.Event()
    def hold():
        with c.exclusive():
            locked.set();release.wait(2)
    worker=threading.Thread(target=hold);worker.start();locked.wait(2)
    try:
        with pytest.raises(HTTPException) as exc:c.apply({'brightness':1})
        assert exc.value.status_code==409
    finally:
        release.set();worker.join()


@pytest.mark.parametrize('mode',['complete','cancelled','failed'])
def test_night_averages_fresh_frames_and_always_restores(controller, monkeypatch, mode):
    c, controls, _ = controller
    clock = [0.0]
    monkeypatch.setattr(nc.time,'monotonic',lambda:clock[0])
    saved=[]
    camera=SimpleNamespace(sequence=0)
    def next_frame(after,timeout):
        assert after==camera.sequence
        if mode=='failed':raise HTTPException(503,'unplugged')
        camera.sequence+=1
        return np.full((2,2,3),30,np.uint8),camera.sequence
    camera.next_frame=next_frame
    job=nc.NightCapture(camera,c,lambda frame:saved.append(frame) or {'url':'/api/photos/test.jpg'})
    class Cancel:
        def wait(self,seconds): clock[0]+=seconds;return mode=='cancelled'
        def is_set(self): return mode=='cancelled'
    job.cancel_event=Cancel()
    job.run(1)
    assert job.status()['status']==mode
    assert {k:v['value'] for k,v in controls.items()}==c.baseline
    assert c.desired=={}
    if mode=='complete':
        assert job.status()['frames']>=2
        assert np.all(saved[0]==30)  # Average, never a misleading exposure sum.
    else:assert not saved


def test_restart_restores_baseline_plus_saved_values(controller):
    c, controls, _ = controller
    c.apply({'brightness':8})
    c.apply(c.night_values(),persist=False)
    assert controls['gain']['value']==100
    c.initialize()
    assert controls['brightness']['value']==8
    assert controls['gain']['value']==0
    assert controls['auto_exposure']['value']==3


def test_focus_and_white_balance_disable_auto_before_manual_write(tmp_path, monkeypatch):
    sample = '''
 focus_automatic_continuous 0x009a090c (bool) : default=1 value=1
 focus_absolute 0x009a090a (int) : min=0 max=255 step=5 default=0 value=25 flags=inactive
 white_balance_temperature_auto 0x0098090c (bool) : default=1 value=1
 white_balance_temperature 0x0098091a (int) : min=2800 max=6500 step=1 default=4600 value=4600 flags=inactive
 sharpness 0x0098091b (int) : min=0 max=6 step=1 default=57343 value=3
'''
    c = cc.CameraControls('/dev/video0', tmp_path/'focus.json')
    controls = cc.parse_controls(sample)
    writes = []
    monkeypatch.setattr(c, 'read', lambda: {k:dict(v) for k,v in controls.items()})
    def command(arg):
        name, value = arg.removeprefix('--set-ctrl=').split('=')
        key = cc.ALIASES.get(name, name)
        if key in cc.DEPENDENCIES:
            auto, off = cc.DEPENDENCIES[key]
            assert controls[auto]['value'] == off
        controls[key]['value'] = int(value)
        writes.append((key,int(value)))
    monkeypatch.setattr(c,'command',command)
    c.initialize()
    assert c.info()['focus_supported'] and c.info()['autofocus_supported']
    assert controls['focus_absolute']['manual_when'] == {'control':'focus_auto','value':0}
    assert controls['sharpness']['default'] is None
    c.apply({'focus_absolute':50,'white_balance_temperature':5000})
    assert controls['focus_auto']['value'] == 0
    assert controls['white_balance_automatic']['value'] == 0
    c.apply({'focus_auto':1,'white_balance_automatic':1})
    assert controls['focus_auto']['value'] == 1
    assert controls['white_balance_automatic']['value'] == 1
    c.restore()
    assert controls['focus_absolute']['value'] == 25
    assert controls['focus_auto']['value'] == 1


def test_unavailable_focus_is_not_offered(controller):
    c, _, _ = controller
    assert not c.info()['focus_supported']
    assert not c.info()['autofocus_supported']
    with pytest.raises(HTTPException): c.apply({'focus_absolute':25})
