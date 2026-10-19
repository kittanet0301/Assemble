import { writeFileSync } from 'node:fs';
import { OFFICE_SCENE } from '../shared/office-scene.js';

// Export the same authoritative world geometry used by both client and server.
for (const target of [
  'public/maps/pixel-office/scene.json',
  'assets/map/pixel-office/scene.json',
]) {
  writeFileSync(new URL(`../${target}`, import.meta.url), JSON.stringify(OFFICE_SCENE, null, 2));
}
console.log(`${OFFICE_SCENE.props.length} scene objects exported`);
