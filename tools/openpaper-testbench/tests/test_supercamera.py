from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parents[1]/'api'))
from supercamera import FrameAssembler, discover


def packet(fid,data,extra=b'',camera=0):
    header=bytes([fid,camera,0,0,0,0,0])
    return b'\xaa\xbb\x07'+(len(header)+len(data)).to_bytes(2,'little')+header+data+extra


def test_0329_retransmitted_tail_is_ignored():
    parser=FrameAssembler()
    assert parser.feed(packet(1,b'\xff\xd8hello',b'IGNORE')) is None
    assert parser.feed(packet(1,b'world\xff\xd9')) is None
    assert parser.feed(packet(2,b'\xff\xd8next'))==b'\xff\xd8helloworld\xff\xd9'


def test_bad_or_oversize_frames_never_escape():
    parser=FrameAssembler();parser.LIMIT=20
    assert parser.feed(packet(1,b'\xff\xd8'+b'x'*30)) is None
    assert len(parser.buffer)==0
    parser.feed(packet(2,b'\xff\xd8partial'))
    parser.feed(b'broken')
    assert parser.feed(packet(3,b'\xff\xd8next')) is None
    assert parser.feed(packet(4,b'\xff\xd8other')) is None


def test_supported_devices_have_stable_identity(tmp_path):
    p=tmp_path/'1-1.3.4';p.mkdir()
    (p/'idVendor').write_text('0329');(p/'idProduct').write_text('2022')
    assert discover(tmp_path)[0]['id']=='supercamera:1-1.3.4'
    (p/'idProduct').write_text('1234')
    assert discover(tmp_path)==[]
