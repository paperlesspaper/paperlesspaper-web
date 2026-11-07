from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import numpy as np
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from rig import Rig, RigConfig, FrameProfile, Point, rectify
from light import Light, cct_packet


def config():
    return RigConfig(frames=[FrameProfile(id='one',name='One',camera='demo-camera-1'), FrameProfile(id='two',name='Two',camera='demo-camera-2')],detail_camera='demo-camera-3')


def test_profiles_persist_and_conflicting_edits_fail(tmp_path):
    rig = Rig(tmp_path, None, True)
    saved = rig.save(config())
    assert Rig(tmp_path,None,True).snapshot() == saved
    with pytest.raises(HTTPException) as error: rig.save(config())
    assert error.value.status_code == 409
    assert rig.profile('two').camera == 'demo-camera-2'
    with pytest.raises(HTTPException): rig.profile('../one')


def test_devices_cannot_be_shared_or_injected(tmp_path):
    c = config().model_dump()
    c['detail_camera'] = 'demo-camera-1'
    with pytest.raises(ValidationError): RigConfig(**c)
    c = config(); c.frames[0].camera = '/etc/passwd'
    with pytest.raises(HTTPException): Rig(tmp_path,None,True).save(c)
    c = config().model_dump(); c['light_device']='/dev/serial/by-path/lamp'; c['frames'][0]['relay']=c['light_device']
    with pytest.raises(ValidationError): RigConfig(**c)


def test_quad_validation_and_perspective_crop(tmp_path):
    image = np.zeros((100,200,3),np.uint8)
    image[20:80,40:160] = 255
    corners=[Point(x=x,y=y) for x,y in [(.2,.2),(.8,.2),(.8,.8),(.2,.8)]]
    result=rectify(image,corners)
    assert result.shape == (59,119,3)
    assert result[5:-5,5:-5].mean()==255
    for pts in [[(0,0),(1,1),(1,0),(0,1)],[(0,0),(0,0),(1,1),(0,1)],[(0,0),(0,1),(1,1),(1,0)]]:
        with pytest.raises(ValidationError): FrameProfile(id='x',name='x',corners=[{'x':x,'y':y} for x,y in pts])
    rig=Rig(tmp_path,None,True); f=config().frames[0]; original=rig.reference_path(f)
    f.corners=corners
    assert rig.reference_path(f)!=original
    f.camera='demo-camera-2'
    assert rig.reference_path(f)!=original


def test_light_leases_multiple_tabs_expiry_logout_and_restart(tmp_path):
    now=[0]; valid={'session'}
    light=Light(tmp_path/'light.json',lambda:'lamp',lambda s:s in valid,clock=lambda:now[0])
    sent=[];light.send=lambda *args:sent.append(args)
    light.tick();assert sent[-1][1]==0
    light.heartbeat('a',True,'session');light.tick();assert sent[-1][1]==100
    now[0]=5;light.heartbeat('b',True,'session');light.heartbeat('a',False)
    light.tick();assert sent[-1][1]==100
    now[0]=21;light.tick();assert sent[-1][1]==0
    light.heartbeat('b',True,'session');valid.clear();light.tick();assert sent[-1][1]==0
    light.configure({'enabled':False,'brightness':70,'kelvin':7000})
    restarted=Light(tmp_path/'light.json',lambda:'lamp',clock=lambda:now[0])
    assert restarted.status()['brightness']==100 and not restarted.status()['active_browser']
    light.close();assert sent[-1][1]==0


def test_light_device_switch_shuts_old_device_off_and_errors_retry(tmp_path):
    device=['old'];sent=[]
    light=Light(tmp_path/'light.json',lambda:device[0])
    light.send=lambda *args:sent.append(args)
    light.heartbeat('a',True);light.tick()
    device[0]='new';light.tick()
    assert sent[-2][0:2]==('old',0) and sent[-1][0:2]==('new',100)
    def fail(*args): raise OSError('unplugged')
    light.send=fail;light.tick()
    assert light.status()['confirmed'] is False and light.status()['commanded_brightness'] is None
    light.send=lambda *args:sent.append(args);light.heartbeat('a',False);light.tick()
    assert sent[-1][1]==0 and light.status()['error'] is None


def test_pl81_wire_packet():
    assert cct_packet(100,4950)==bytes.fromhex('3a 02 03 01 64 09 00 ad')
    assert cct_packet(0,2900)==bytes.fromhex('3a 02 03 01 00 00 00 40')
    assert cct_packet(100,7000)[5]==18


def test_light_permanent_modes_persist_without_browser_and_switch_back(tmp_path):
    now = [0]
    path = tmp_path/'light.json'
    light = Light(path, lambda:'lamp', clock=lambda:now[0])
    sent = []
    light.send = lambda *args:sent.append(args)
    light.configure({'mode':'on','brightness':20,'kelvin':7000})
    light.tick()
    assert sent[-1][1] == 100
    light.heartbeat('a',True)
    now[0] = 100
    light.tick()
    assert not light.status()['active_browser'] and sent[-1][1] == 100
    light.heartbeat('a',False)
    light.close()
    assert sent[-1][1] == 0  # Graceful shutdown, without changing the saved mode.
    light = Light(path, lambda:'lamp', clock=lambda:now[0])
    light.send = lambda *args:sent.append(args)
    light.tick()
    assert light.status()['mode'] == 'on' and sent[-1][1] == 100
    light.configure({'mode':'auto','kelvin':7000})
    light.tick()
    assert sent[-1][1] == 0
    light.heartbeat('a',True)
    light.tick()
    assert sent[-1][1] == 100
    light.configure({'mode':'off','kelvin':7000})
    light.tick()
    assert light.status()['active_browser'] and sent[-1][1] == 0
    restarted = Light(path, lambda:'lamp')
    restarted.send = lambda *args:sent.append(args)
    restarted.heartbeat('b',True)
    restarted.tick()
    assert restarted.status()['mode'] == 'off' and sent[-1][1] == 0


@pytest.mark.parametrize('enabled,mode', [(True,'auto'),(False,'off')])
def test_light_legacy_settings_migrate(tmp_path, enabled, mode):
    import json
    path = tmp_path/'light.json'
    path.write_text(json.dumps({'enabled':enabled,'brightness':70,'kelvin':4950}))
    light = Light(path, lambda:'lamp')
    assert light.status()['mode'] == mode
    assert light.status()['brightness'] == 100
    assert light.status()['kelvin'] == 4950


@pytest.mark.parametrize('rotation',[90,180,270])
def test_rotation_persists_and_preserves_calibrated_region(tmp_path, rotation):
    from rig import orient, rotate_corners
    rig=Rig(tmp_path,None,True)
    original=config()
    original.frames[0].corners=[Point(x=x,y=y) for x,y in [(.1,.2),(.7,.2),(.7,.9),(.1,.9)]]
    saved=rig.save(original)
    old=saved.frames[0].model_copy(deep=True)
    saved.frames[0].rotation=rotation
    saved=rig.save(saved)
    assert Rig(tmp_path,None,True).profile('one').rotation==rotation
    assert saved.frames[0].corners==rotate_corners(old.corners,rotation)
    assert rig.reference_path(old)!=rig.reference_path(saved.frames[0])
    image=np.zeros((100,200,3),np.uint8)
    image[20:90,20:140]=255
    cropped=rectify(orient(image,rotation),saved.frames[0].corners)
    assert cropped[5:-5,5:-5].mean()==255
    saved.frames[0].rotation=0
    restored=rig.save(saved).frames[0]
    assert np.allclose([[p.x,p.y] for p in restored.corners],[[p.x,p.y] for p in old.corners])
