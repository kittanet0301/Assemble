import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRITE, SPRITE_ANIMATIONS, spriteRow, walkFrame } from '../shared/sprites.js';

test('sprite layout is compatible with ZEP frame dimensions and direction indices', () => {
  assert.equal(SPRITE.frameWidth, 48);
  assert.equal(SPRITE.frameHeight, 64);
  const indices = Object.values(SPRITE_ANIMATIONS).flat();
  assert.deepEqual(
    [...indices].sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i),
  );
  for (const [direction, frames] of Object.entries(SPRITE_ANIMATIONS)) {
    assert.equal(frames[0], spriteRow(direction) * SPRITE.columns);
    assert.equal(frames.length, 4);
  }
});
test('walking advances exactly eight frames per second and loops to neutral', () => {
  assert.equal(SPRITE.fps, 8);
  assert.deepEqual(
    [0, 124, 125, 249, 250, 374, 375, 499, 500].map(walkFrame),
    [0, 0, 1, 1, 2, 2, 3, 3, 0],
  );
  assert.equal(walkFrame(-1), 0);
});
