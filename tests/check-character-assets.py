"""Regression check for lost portrait detail and static walk silhouettes."""
from pathlib import Path
from PIL import Image, ImageChops
import json

root = Path(__file__).resolve().parents[1]
folder = root / 'public/characters'
meta = json.loads((folder/'pipeline-meta.json').read_text())
width = meta['frame_width']*meta['hd_scale']
height = meta['frame_height']*meta['hd_scale']
assert (meta['frame_width'],meta['frame_height'],meta['fps']) == (48,64,8)
failures = []
for n in range(4):
    head = Image.open(folder/f'head-{n}.png').convert('RGBA').crop((0,0,width,height))
    box = head.getbbox()
    detail = box[3]-box[1]
    print(f'head-{n}: {detail} source pixels available for a 72px portrait')
    if detail < 48:
        failures.append(f'head-{n}: detail discarded before display ({detail} < 48)')
for n in range(3):
    sheet = Image.open(folder/f'body-{n}.png').convert('RGBA')
    for row in range(4):
        # Compare only lower legs, independently from arm/torso motion.
        legs = [sheet.crop((c*width,row*height+round(height*.70),(c+1)*width,(row+1)*height)).getchannel('A') for c in range(4)]
        diffs = [sum(v>0 for v in ImageChops.difference(legs[0],legs[c]).tobytes()) for c in [1,3]]
        print(f'body-{n} row-{row}: changed lower-leg pixels {diffs}')
        if min(diffs) < 4:
            failures.append(f'body-{n} row-{row}: walk legs lack visible stride')
if failures:
    raise SystemExit('FAIL\n'+'\n'.join(failures))
for part,count in [('head',4),('body',3)]:
    for n in range(count):
        native = Image.open(folder/f'native/{part}-{n}.png')
        assert native.size == (192,256)
        assert Image.open(folder/f'native/{part}-{n}-mask.png').size == native.size
for exported in (root/'assets/characters/zep').glob('avatar-*.png'):
    sheet = Image.open(exported)
    assert sheet.size == (192,256)
    for row in range(4):
        for col in range(4):
            box = sheet.crop((col*48,row*64,(col+1)*48,(row+1)*64)).getbbox()
            assert box and box[0]>0 and box[2]<48 and box[3]==57
print('PASS: portrait detail retained; every direction has distinct leg strides.')
