"""Normalize generated images; never draws or invents map artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/props/pixel-office'
OUTPUT = ROOT / 'public/maps/pixel-office'
OUTPUT.mkdir(parents=True, exist_ok=True)
SIZES = {
    'workstation': (120, 112), 'meeting': (216, 156), 'sofa': (216, 90),
    'bookshelf': (60, 160), 'coffee_table': (108, 58), 'coffee_bar': (192, 72),
    'plant': (64, 88), 'planter': (192, 64),
    'wall_horizontal': (96, 36), 'wall_vertical': (16, 96),
}
report = []
for name, size in SIZES.items():
    source = Image.open(SOURCE / f'{name}-source.png').convert('RGBA')
    alpha = source.getchannel('A')
    # Remove only generated translucent backdrop halos, preserving opaque artwork.
    solid = alpha.point(lambda value: 255 if value >= 240 else 0)
    bbox = solid.getbbox()
    if not bbox:
        raise ValueError(f'{name}: no opaque foreground')
    if bbox[0] == 0 or bbox[1] == 0 or bbox[2] == source.width or bbox[3] == source.height:
        raise ValueError(f'{name}: foreground touches source edge')
    source.putalpha(solid)
    image = source.crop(bbox).resize(size, Image.Resampling.NEAREST)
    # A clear one-pixel gutter avoids sampling neighboring transparent RGB values.
    result = Image.new('RGBA', (size[0] + 2, size[1] + 2))
    result.alpha_composite(image, (1, 1))
    result.save(OUTPUT / f'{name}.png', optimize=True)
    result.save(SOURCE / f'{name}.png', optimize=True)
    report.append({'id': name, 'sourceSize': source.size, 'sourceCrop': bbox,
                   'displaySize': size, 'fileSize': result.size, 'gutter': 1,
                   'alpha': result.getchannel('A').getextrema(), 'edge_touch': False,
                   'prompt': f'assets/props/pixel-office/{name}.prompt.txt'})

for name in ('base', 'dressed-reference'):
    source = Image.open(ROOT / f'assets/map/pixel-office/{name}-source.png').convert('RGB')
    normalized = source.resize((1344, 960), Image.Resampling.NEAREST)
    normalized.save(ROOT / f'assets/map/pixel-office/{name}.png', optimize=True)
    if name == 'base':
        normalized.save(OUTPUT / 'base.png', optimize=True)
(ROOT / 'assets/map/pixel-office/asset-validation.json').write_text(json.dumps(report, indent=2), encoding='utf8')
scene_path = ROOT / 'assets/map/pixel-office/scene.json'
if scene_path.exists():
    scene = json.loads(scene_path.read_text(encoding='utf8'))
    preview = Image.open(OUTPUT / 'base.png').convert('RGBA')
    for prop in sorted(scene['props'], key=lambda item: item['sortY']):
        image = Image.open(ROOT / 'public' / prop['image'].lstrip('/')).convert('RGBA')
        image = image.crop((1, 1, image.width - 1, image.height - 1))
        image = image.resize((prop['w'], prop['h']), Image.Resampling.NEAREST)
        preview.alpha_composite(image, (prop['x'], prop['y']))
    preview.save(ROOT / 'assets/map/pixel-office/layered-preview.png', optimize=True)
print(json.dumps({'props': len(report), 'baseSize': [1344, 960], 'edge_touch': False}))
