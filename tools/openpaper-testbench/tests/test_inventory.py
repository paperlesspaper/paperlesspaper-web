from pathlib import Path
import sys
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1] / 'api'))
import rig


def test_discovery_does_not_open_usb_devices_and_filters_metadata(tmp_path, monkeypatch):
    video, sysfs, serial = (tmp_path/name for name in ('video-paths','sysfs','serial-paths'))
    for path in (video,sysfs,serial): path.mkdir()
    for number,index in ((0,0),(1,1),(2,0)):
        device=tmp_path/f'video{number}'
        device.touch()
        (video/f'usb-{number}-video-index{index}').symlink_to(device)
        node=sysfs/device.name;node.mkdir()
        (node/'index').write_text(str(index))
        (node/'name').write_text('USB Camera')
    (video/'duplicate').symlink_to(tmp_path/'video0')
    (video/'unplugged').symlink_to(tmp_path/'video9')
    (serial/'usb-uart').symlink_to(tmp_path/'ttyUSB0')
    port=SimpleNamespace(device=str(tmp_path/'ttyUSB0'),description='UART',vid=0x10c4,pid=0xea60,serial_number=None)
    monkeypatch.setattr(rig.list_ports,'comports',lambda:[port])
    monkeypatch.setattr(rig,'discover_supercameras',lambda:[])
    def forbidden(*args,**kwargs): raise AssertionError('Discovery must not probe USB devices')
    monkeypatch.setattr('subprocess.check_output',forbidden)
    result=rig.inventory(False,video,sysfs,serial)
    assert {c['device'] for c in result['cameras']} == {str(tmp_path/'video0'),str(tmp_path/'video2')}
    assert len(result['cameras']) == 2
    assert result['ports'][0]['id'] == str(serial/'usb-uart')
