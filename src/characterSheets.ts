import { APPEARANCE_OPTIONS } from '../shared/appearance.js';
import { SPRITE } from '../shared/sprites.js';
import { ZEP_SLOTS } from '../shared/zep-appearance.js';
import type { Appearance, LegacyAppearance, ZepAppearance, ZepSlot } from './types';

const sheets = new Map<string, Promise<string>>();
const images = new Map<string, Promise<HTMLImageElement>>();

function remember<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  limit: number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = load().catch((error) => {
    // An evicted request must not remove a newer request for the same image.
    if (cache.get(key) === pending) cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  return pending;
}

function loadImage(path: string) {
  return remember(
    images,
    path,
    256,
    () =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('โหลดภาพตัวละครไม่สำเร็จ'));
        image.src = path;
      }),
  );
}

async function zepSheet(appearance: ZepAppearance) {
  const slots = ZEP_SLOTS as ZepSlot[];
  const layers = await Promise.all(
    slots
      .filter((slot) => appearance[slot] > 0)
      .map((slot) => loadImage(`/characters/zep/${slot}/${appearance[slot]}.png`)),
  );
  const { frameWidth, frameHeight } = SPRITE;
  const sourceColumns = 9,
    directionFrames = 5,
    directions = 4;
  const source = document.createElement('canvas');
  source.width = sourceColumns * frameWidth;
  source.height = directions * frameHeight;
  const context = source.getContext('2d')!;
  for (const layer of layers) context.drawImage(layer, 0, 0);

  // Repack the original 9×4 sheet into four direction rows:
  // idle followed by all four walk frames. Original files retain all 36 frames.
  const sheet = document.createElement('canvas');
  sheet.width = directionFrames * frameWidth;
  sheet.height = directions * frameHeight;
  const output = sheet.getContext('2d')!;
  output.imageSmoothingEnabled = false;
  for (let row = 0; row < directions; row++)
    for (let col = 0; col < directionFrames; col++) {
      const index = row * directionFrames + col;
      output.drawImage(
        source,
        (index % sourceColumns) * frameWidth,
        Math.floor(index / sourceColumns) * frameHeight,
        frameWidth,
        frameHeight,
        col * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight,
      );
    }
  return sheet.toDataURL('image/png');
}

async function legacySheet(appearance: LegacyAppearance, native: boolean) {
  const paths = [`body-${appearance.shirtStyle}`, `head-${appearance.hairStyle}`];
  const colors = [
    '',
    APPEARANCE_OPTIONS.skin[appearance.skin],
    APPEARANCE_OPTIONS.hairColor[appearance.hairColor],
    APPEARANCE_OPTIONS.shirtColor[appearance.shirtColor],
    APPEARANCE_OPTIONS.pantsColor[appearance.pantsColor],
  ];
  const palette = colors.map((color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  for (const [index, path] of paths.entries()) {
    const folder = native ? 'native/' : '';
    const [art, mask] = await Promise.all([
      loadImage(`/characters/${folder}${path}.png?v=zep-art-v2`),
      loadImage(`/characters/${folder}${path}-mask.png?v=zep-art-v2`),
    ]);
    if (index === 0) {
      canvas.width = art.naturalWidth;
      canvas.height = art.naturalHeight;
    }
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext('2d')!;
    layerContext.drawImage(mask, 0, 0);
    const codes = layerContext.getImageData(0, 0, canvas.width, canvas.height).data;
    layerContext.clearRect(0, 0, canvas.width, canvas.height);
    layerContext.drawImage(art, 0, 0);
    const pixels = layerContext.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const region = codes[i];
      if (!pixels.data[i + 3] || region < 1 || region > 4) continue;
      const shade = codes[i + 1] / 128;
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[i + channel] = Math.min(255, palette[region][channel] * shade);
      }
    }
    layerContext.putImageData(pixels, 0, 0);
    context.drawImage(layer, 0, 0);
  }
  return canvas.toDataURL('image/png');
}

export function characterSheet(appearance: Appearance, native: boolean) {
  const zep = 'source' in appearance;
  const key = JSON.stringify([appearance, zep ? false : native]);
  return remember(sheets, key, 128, () =>
    zep ? zepSheet(appearance) : legacySheet(appearance, native),
  );
}
