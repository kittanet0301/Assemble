// ZEP loadSpritesheet-compatible frame geometry and directional indices.
export const SPRITE = Object.freeze({
  frameWidth: 48,
  frameHeight: 64,
  columns: 4,
  rows: 4,
  fps: 8,
  idleFrame: 0,
});
export const SPRITE_DIRECTIONS = ['down', 'left', 'right', 'up'];
export const SPRITE_ANIMATIONS = Object.fromEntries(
  SPRITE_DIRECTIONS.map((direction, row) => [
    direction,
    Array.from({ length: SPRITE.columns }, (_, col) => row * SPRITE.columns + col),
  ]),
);
export const spriteRow = (direction) => Math.max(0, SPRITE_DIRECTIONS.indexOf(direction));
export const walkFrame = (elapsedMs) =>
  Math.floor((Math.max(0, elapsedMs) * SPRITE.fps) / 1000) % SPRITE.columns;
