"""Deterministic cleanup/layer extraction from ImageGen originals. No art is drawn.

Run generate2dsprite's processor first to obtain reviewed frame bboxes/QC.
Re-sample its source bboxes with NEAREST (the generic processor uses Lanczos),
register every layer at the neckline, and export recoloring masks.
"""
from pathlib import Path
from PIL import Image
import colorsys
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters/v2'
OUT = ROOT / 'public/characters'
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'native').mkdir(parents=True, exist_ok=True)
NAMES = ['base', 'bob', 'curly', 'tied', 'collar', 'cardigan']
CELL = 192
SCALE = CELL // 64
FRAME_WIDTH = 48
FRAME_HEIGHT = 64
HD_WIDTH = FRAME_WIDTH*SCALE

def hsv(pixel):
    return colorsys.rgb_to_hsv(*(c / 255 for c in pixel[:3]))

def cyan(pixel):
    h, s, v = hsv(pixel)
    return pixel[3] > 0 and .43 < h < .57 and s > .3

def clean(im):
    im = im.copy().convert('RGBA')
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            # Key true magenta only. Purple clothing must remain opaque.
            h, s, v = hsv((r,g,b,a))
            if .79 < h < .91 and s > .45 and r > 80 and b > 80:
                im.putpixel((x, y), (0, 0, 0, 0))
    return im

def frames(name):
    meta = json.loads((SOURCE / f'processed/{name}/pipeline-meta.json').read_text())
    assert not meta['edge_touch_frames'], name
    raw = Image.open(SOURCE / f'source/{name}.png').convert('RGBA')
    result = []
    for info in meta['frames']:
        sx, sy, _, _ = info['source_box']
        x0, y0, x1, y1 = info['crop_bbox']
        art = clean(raw.crop((sx+x0, sy+y0, sx+x1, sy+y1)))
        # Sample the original once at delivery resolution. Never enlarge the
        # discarded-detail 64px intermediate sheet into portraits/previews.
        art = art.resize(tuple(v*SCALE for v in info['output_size']), Image.Resampling.NEAREST)
        frame = Image.new('RGBA', (CELL, CELL))
        frame.paste(art, tuple(v*SCALE for v in info['paste_position']))
        result.append(frame)
    return result

def parts(frame):
    # Neck seam is the first row containing a substantial span of shirt.
    rows = [y for y in range(20*SCALE, 45*SCALE) if sum(cyan(frame.getpixel((x,y))) for x in range(CELL)) >= 4*SCALE]
    assert rows, 'missing shirt seam'
    seam = rows[0]
    bbox = frame.getbbox()
    assert bbox
    # Use the shirt at its neckline as the shared registration point.
    neck_x = [x for y in range(seam, seam+2*SCALE) for x in range(CELL) if cyan(frame.getpixel((x,y)))]
    cx = round((min(neck_x) + max(neck_x))/2)
    head = frame.crop((0, bbox[1], CELL, seam))
    body = frame.crop((0, seam, CELL, bbox[3]))
    # ZEP-style large rounded head and compact body (~2 heads tall).
    head_h = 24*SCALE
    head_scale = head_h / head.height
    head = head.resize((round(CELL*head_scale), head_h), Image.Resampling.NEAREST)
    body = body.resize((CELL, 22*SCALE), Image.Resampling.NEAREST)
    head_layer, body_layer = Image.new('RGBA',(CELL,CELL)), Image.new('RGBA',(CELL,CELL))
    head_layer.paste(head, (round(CELL/2-cx*head_scale), 11*SCALE))
    body_layer.paste(body, (round(CELL/2-cx), 35*SCALE))
    return head_layer, body_layer

def mask(art, head):
    out = Image.new('RGBA', art.size)
    # Hair is the blue component connected to the crown, while blue eyes are
    # isolated inside skin. Keep eye details independent from the hair palette.
    hair_pixels = set()
    if head:
        blue = set()
        for y in range(art.height):
            for x in range(art.width):
                r,g,b,a = art.getpixel((x,y))
                if a and b > r+3 and b > g:
                    blue.add((x,y))
        pending = [p for p in blue if p[1] % CELL < 18*SCALE]
        hair_pixels.update(pending)
        while pending:
            x,y = pending.pop()
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                p = (x+dx,y+dy)
                if p in blue and p not in hair_pixels:
                    hair_pixels.add(p)
                    pending.append(p)
    for y in range(art.height):
        for x in range(art.width):
            pixel = art.getpixel((x,y))
            if not pixel[3]:
                continue
            r,g,b,_ = pixel
            h,s,v = hsv(pixel)
            region, reference = 0, 1
            local_y = y % CELL
            if head:
                # Keep the new character's dark brown eyes and outlines fixed.
                if v > .48 and r > b*1.1 and r > g*1.04 and h < .15:
                    region,reference = 1, .80
                elif (x,y) in hair_pixels:
                    region,reference = 2, .28
            else:
                if r > b*1.15 and r > g*1.04 and h < .15:
                    region,reference = 1,.80
                elif .42 < h < .59 and s > .20:
                    region,reference = 3,.65
                elif .65 < h < .85:
                    region,reference = 4,.48
            shade = max(.28, min(1.65, v/reference))
            out.putpixel((x,y), (region,round(shade*128),0,255))
    return out

all_frames = {name: [parts(frame) for frame in frames(name)] for name in NAMES}
for kind, names, part_index in [('head',['base','bob','curly','tied'],0),('body',['base','collar','cardigan'],1)]:
    for i,name in enumerate(names):
        sheet = Image.new('RGBA',(HD_WIDTH*4,CELL*4))
        for n, pair in enumerate(all_frames[name]):
            # Center-crop transparent side padding; never squash the subject.
            layer = pair[part_index].crop((8*SCALE,0,56*SCALE,CELL))
            sheet.paste(layer, ((n%4)*HD_WIDTH,(n//4)*CELL))
        sheet.save(OUT/f'{kind}-{i}.png')
        recolor_mask = mask(sheet, kind=='head')
        recolor_mask.save(OUT/f'{kind}-{i}-mask.png')
        sheet.resize((FRAME_WIDTH*4,FRAME_HEIGHT*4),Image.Resampling.NEAREST).save(OUT/f'native/{kind}-{i}.png')
        recolor_mask.resize((FRAME_WIDTH*4,FRAME_HEIGHT*4),Image.Resampling.NEAREST).save(OUT/f'native/{kind}-{i}-mask.png')

# QA: every combination has transparent margins, fixed feet and visible neck.
report = []
for hair in range(4):
    for shirt in range(3):
        body = Image.open(OUT/f'body-{shirt}.png').convert('RGBA')
        body.alpha_composite(Image.open(OUT/f'head-{hair}.png').convert('RGBA'))
        for row in range(4):
            for col in range(4):
                frame = body.crop((col*HD_WIDTH,row*CELL,(col+1)*HD_WIDTH,(row+1)*CELL))
                bbox = frame.getbbox()
                assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<HD_WIDTH and bbox[3]<CELL
                assert bbox[3] == 57*SCALE, (hair,shirt,row,col,bbox)
        report.append({'hair':hair,'shirt':shirt,'frames':16,'edge_touch':False,'feet_baseline':57*SCALE})
anims = {direction:list(range(row*4,row*4+4)) for row,direction in enumerate(['down','left','right','up'])}
(OUT/'pipeline-meta.json').write_text(json.dumps({'source':'Original ImageGen art, deterministic ZEP-compatible atlas assembly','frame_width':FRAME_WIDTH,'frame_height':FRAME_HEIGHT,'hd_scale':SCALE,'fps':8,'rows':['down','left','right','up'],'columns':['idle','stride-left','idle','stride-right'],'anims':anims,'combinations':report},indent=2))

def tinted(art, codes, palette):
    art = art.copy().convert('RGBA')
    for y in range(art.height):
        for x in range(art.width):
            region, shade, _, _ = codes.getpixel((x,y))
            alpha = art.getpixel((x,y))[3]
            if alpha and 1 <= region <= 4:
                art.putpixel((x,y),tuple(min(255,round(c*shade/128)) for c in palette[region])+(alpha,))
    return art

def styled(hair, shirt, native=False, first_only=False):
    folder = OUT/'native' if native else OUT
    colors = ['', ['f2c6a5','dba67d','b97c59','80513d'][hair], ['35313f','72503c','b08350','837399'][hair], ['8fbfb0','b3a3d6','dfab99'][shirt], '596477']
    palette = [None]+[tuple(int(c[i:i+2],16) for i in (0,2,4)) for c in colors[1:]]
    result = None
    for name in [f'body-{shirt}',f'head-{hair}']:
        art = Image.open(folder/f'{name}.png').convert('RGBA')
        codes = Image.open(folder/f'{name}-mask.png').convert('RGBA')
        if first_only:
            box = (0,0,FRAME_WIDTH if native else HD_WIDTH,FRAME_HEIGHT if native else CELL)
            art,codes = art.crop(box),codes.crop(box)
        layer = tinted(art,codes,palette)
        if result is None:
            result = layer
        else:
            result.alpha_composite(layer)
    return result

# Contact sheet uses the same color masks as the browser's real avatars.
contact = Image.new('RGBA',(4*144,3*192),(245,241,249,255))
for h in range(4):
    for s in range(3):
        contact.alpha_composite(styled(h,s,first_only=True),(h*144,s*192))
contact.save(SOURCE/'layer-contact-sheet.png')
print('Exported 7 modular atlases + masks; all 192 combined frames pass containment and feet checks.')

# Export a complete, directly loadable ZEP PNG for each outfit silhouette.
# Native layered files are used by our editor; these examples need no layers.
zep_dir = ROOT/'assets/characters/zep'
zep_dir.mkdir(exist_ok=True)
for h in range(4):
    for s in range(3):
        full = styled(h,s,native=True)
        full.save(zep_dir/f'avatar-h{h}-s{s}.png')
(zep_dir/'main.js').write_text("// Use any exported avatar-h*-s*.png as the fileName.\nconst avatar = App.loadSpritesheet('avatar-h0-s0.png', 48, 64, "+json.dumps(anims)+", 8);\nApp.onJoinPlayer.Add(function(player) { player.sprite = avatar; player.sendUpdated(); });\n")

# Transparent delivery GIFs from the final composed layers, one per direction.
full = styled(0,0)
for row,direction in enumerate(['down','left','right','up']):
    animation = []
    for col in range(4):
        frame = full.crop((col*HD_WIDTH,row*CELL,(col+1)*HD_WIDTH,(row+1)*CELL))
        gif_frame = frame.convert('RGB').quantize(colors=255)
        gif_frame.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a==0 else 0))
        gif_frame.info['transparency'] = 255
        animation.append(gif_frame)
    animation[0].save(SOURCE/f'walk-{direction}.gif',save_all=True,append_images=animation[1:],duration=125,loop=0,disposal=2,transparency=255,optimize=False)
