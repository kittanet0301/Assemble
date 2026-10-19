import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { OFFICE_SCENE } from '../shared/office-scene.js';
import { DESKS, WALLS, WORLD, canStand, findPath, seatPosition } from '../shared/world.js';

test('generated office map uses separate runtime images and exported authoritative geometry', () => {
  const exported = JSON.parse(
    readFileSync(new URL('../public/maps/pixel-office/scene.json', import.meta.url)),
  );
  assert.deepEqual(exported, OFFICE_SCENE);
  assert.equal(OFFICE_SCENE.props.filter((prop) => prop.deskId).length, DESKS.length);
  assert.equal(new Set(OFFICE_SCENE.props.map((prop) => prop.id)).size, OFFICE_SCENE.props.length);
  for (const prop of OFFICE_SCENE.props) {
    const bytes = readFileSync(new URL(`../public${prop.image}`, import.meta.url));
    assert.equal(bytes.readUInt8(25), 6); // PNG color type 6: RGBA.
    assert.ok(prop.w > 0 && prop.h > 0 && prop.sortY >= 0);
    assert.ok(
      existsSync(new URL(`../assets/props/pixel-office/${prop.asset}.prompt.txt`, import.meta.url)),
    );
  }
});
test('furniture collision matches server geometry, door gaps and seats stay open', () => {
  for (const prop of OFFICE_SCENE.props.filter((prop) => !prop.id.startsWith('wall-'))) {
    assert.ok(
      OFFICE_SCENE.collision.some((rect) =>
        ['x', 'y', 'w', 'h'].every((key) => rect[key] === prop.collision[key]),
      ),
      prop.id,
    );
  }
  const wallArea = WALLS.reduce((sum, rect) => sum + rect.w * rect.h, 0);
  const visualArea = OFFICE_SCENE.props
    .filter((prop) => prop.id.startsWith('wall-'))
    .reduce((sum, prop) => sum + prop.collision.w * prop.collision.h, 0);
  assert.equal(visualArea, wallArea);
  for (const room of OFFICE_SCENE.hooks.rooms) {
    const doorCenter = { x: room.door.x + 12, y: room.door.y + 36 };
    assert.ok(canStand(doorCenter.x, doorCenter.y));
    assert.ok(findPath(WORLD.spawn, room.entry).length);
  }
  for (const desk of DESKS) assert.ok(findPath(WORLD.spawn, seatPosition(desk.id)).length);
});
