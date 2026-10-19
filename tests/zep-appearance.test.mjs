import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ZEP_CATALOG, ZEP_SLOTS, defaultZepAppearance } from '../shared/zep-appearance.js';
import { validAppearance, resolveAppearance } from '../shared/appearance.js';
import { createStore } from '../server/store.mjs';
import { Office } from '../server/office.mjs';

test('all catalog options have complete, verified local sprite sheets', () => {
  const result = JSON.parse(
    readFileSync(new URL('../research/zep-avatar/download-results.json', import.meta.url)),
  );
  const files = new Map(result.files.map((file) => [`${file.slot}/${file.partId}`, file]));
  assert.equal(result.downloaded, result.expected);
  for (const slot of ZEP_SLOTS)
    for (const shape of ZEP_CATALOG[slot])
      for (const part of shape.parts) {
        const bytes = readFileSync(
          new URL(`../public/characters/zep/${slot}/${part.id}.png`, import.meta.url),
        );
        assert.equal(bytes.readUInt32BE(16), 432);
        assert.equal(bytes.readUInt32BE(20), 256);
        assert.equal(
          createHash('sha256').update(bytes).digest('hex'),
          files.get(`${slot}/${part.id}`).sha256,
        );
      }
});
test('ZEP outfits reject unknown part IDs, cross-slot IDs, missing fields and injected paths', () => {
  const outfit = defaultZepAppearance('member');
  assert.ok(validAppearance(outfit));
  for (const invalid of [
    { ...outfit, hair: 99999 },
    { ...outfit, skin: 0 },
    { ...outfit, hair: '../secret' },
    { ...outfit, hair: '1' },
    { ...outfit, source: 'external' },
    { ...outfit, url: 'https://other.test' },
    { source: 'zep', skin: 1 },
  ])
    assert.equal(validAppearance(invalid), false);
  assert.deepEqual(resolveAppearance(JSON.stringify(outfit)), outfit);
  assert.equal(validAppearance({ ...outfit, glasses: 0, mask: 0 }), true);
});
test('ZEP appearance survives storage, sessions, live peer snapshots and chat history', (t) => {
  const store = createStore(':memory:');
  t.after(() => store.close());
  const member = store.upsertMember({ identity: 'zep:test', name: 'Zep' });
  const token = store.newSession({ memberId: member.id });
  const outfit = defaultZepAppearance('custom');
  outfit.glasses = ZEP_CATALOG.glasses.at(-1).parts[0].id;
  store.setAppearance(member.id, outfit);
  const user = store.session(token);
  assert.deepEqual(user.appearance, outfit);
  const office = new Office(store),
    peer = office.connect(
      user,
      () => {},
      () => {},
      () => true,
    );
  assert.deepEqual(office.snapshot(peer).peers[0].appearance, outfit);
  assert.deepEqual(office.snapshot(peer).directory[0].appearance, outfit);
  store.addMessage(user, 'general', 'test');
  assert.deepEqual(store.history('general')[0].appearance, outfit);
});
