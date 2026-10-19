import {
  WORLD,
  DESKS,
  DESK_SHAPE,
  ROOMS,
  PLANTS,
  FURNITURE,
  WALLS,
  OBSTACLES,
  seatPosition,
} from './world.js';

const sprite = (id, asset, x, y, w, h, sortY, collision, extra = {}) => ({
  id,
  asset,
  image: `/maps/pixel-office/${asset}.png`,
  x,
  y,
  w,
  h,
  sortY,
  anchor: 'top-left',
  layer: 'props',
  collision,
  ...extra,
});
const desks = DESKS.map((d) =>
  sprite(
    `desk-${d.id}`,
    'workstation',
    d.x,
    d.y - 14,
    120,
    112,
    d.y + DESK_SHAPE.height,
    { x: d.x, y: d.y, w: DESK_SHAPE.width, h: DESK_SHAPE.height },
    { deskId: d.id },
  ),
);
const meetings = ROOMS.map((r) =>
  sprite(`table-${r.id}`, 'meeting', r.x + 68, r.y + 68, 216, 156, r.y + 180, {
    x: r.x + 96,
    y: r.y + 96,
    w: 168,
    h: 84,
  }),
);
const plants = PLANTS.map((p, i) =>
  sprite(`plant-${i}`, 'plant', p.x - 32, p.y - 71, 64, 88, p.y + 17, {
    x: p.x - 17,
    y: p.y - 17,
    w: 34,
    h: 34,
  }),
);
const furniture = FURNITURE.map((p) => {
  const [asset, rise] = p.id.startsWith('sofa')
    ? ['sofa', 30]
    : p.id === 'bookshelf'
      ? ['bookshelf', 16]
      : p.id === 'coffee-table'
        ? ['coffee_table', 16]
        : p.id === 'coffee-bar'
          ? ['coffee_bar', 30]
          : ['planter', 22];
  return sprite(p.id, asset, p.x, p.y - rise, p.w, p.h + rise, p.y + p.h, {
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
  });
});
const walls = WALLS.flatMap((wall, index) => {
  const horizontal = wall.w > wall.h,
    length = horizontal ? wall.w : wall.h;
  return Array.from({ length: Math.ceil(length / 96) }, (_, n) => {
    const extent = Math.min(96, length - n * 96);
    const x = wall.x + (horizontal ? n * 96 : 0),
      y = wall.y + (horizontal ? 0 : n * 96);
    return sprite(
      `wall-${index}-${n}`,
      horizontal ? 'wall_horizontal' : 'wall_vertical',
      horizontal ? x : x - 4,
      horizontal ? y - 28 : y,
      horizontal ? extent : 16,
      horizontal ? 36 : extent,
      horizontal ? y + 8 : y + extent,
      horizontal ? { x, y, w: extent, h: wall.h } : { x, y, w: wall.w, h: extent },
    );
  });
});
export const OFFICE_SCENE = {
  id: 'pixel-office',
  map_mode: 'scene_mode',
  visual_model: 'layered_raster',
  runtime_object_model: ['y_sorted_props', 'interactive_scene_objects', 'scene_hooks'],
  collision_model: 'precise_shapes',
  engine_target: 'project-native',
  width: WORLD.width,
  height: WORLD.height,
  cellSize: WORLD.step,
  base: '/maps/pixel-office/base.png',
  props: [...walls, ...desks, ...meetings, ...furniture, ...plants],
  collision: OBSTACLES,
  cameraBounds: { x: 0, y: 0, w: WORLD.width, h: WORLD.height },
  walkBounds: WORLD.bounds,
  hooks: {
    spawn: WORLD.spawn,
    seats: DESKS.map((d) => ({ id: d.id, ...seatPosition(d.id) })),
    rooms: ROOMS.map((r) => ({
      id: r.id,
      zone: { x: r.x, y: r.y, w: r.w, h: r.h },
      entry: r.entry,
      door: { x: r.x, y: r.y + 168, w: 8, h: 72 },
    })),
  },
};
