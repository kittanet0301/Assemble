import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createStore } from '../server/store.mjs';
import { APPEARANCE_OPTIONS, defaultAppearance, validAppearance } from '../shared/appearance.js';
import { Office } from '../server/office.mjs';

const custom = { skin: 3, hairStyle: 1, hairColor: 2, shirtStyle: 2, shirtColor: 5, pantsColor: 3 };
test('appearance rejects incomplete, out-of-range and injected option values', () => {
  assert.ok(validAppearance(custom));
  for (const input of [
    null,
    [],
    {},
    { ...custom, skin: -1 },
    { ...custom, skin: 4 },
    { ...custom, hairStyle: '1' },
    { ...custom, shirtStyle: 1.5 },
    { ...custom, extra: true },
  ])
    assert.equal(validAppearance(input), false);
  for (const [key, options] of Object.entries(APPEARANCE_OPTIONS))
    assert.equal(validAppearance({ ...custom, [key]: options.length }), false);
});
test('saved appearance survives database reopen, new sessions, chat and live directory', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'assemble-appearance-'));
  let store = createStore(join(folder, 'test.sqlite'));
  t.after(() => {
    store.close();
    assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
    rmSync(folder, { recursive: true, force: true });
  });
  const user = store.upsertMember({ identity: 'test:custom', name: 'Custom' });
  const token = store.newSession({ memberId: user.id });
  store.setAppearance(user.id, custom);
  store.close();
  store = createStore(join(folder, 'test.sqlite'));
  const returned = store.session(token);
  assert.deepEqual(returned.appearance, custom);
  assert.deepEqual(store.member(user.id).appearance, custom);
  const office = new Office(store),
    peer = office.connect(
      returned,
      () => {},
      () => {},
      () => true,
    );
  assert.deepEqual(office.snapshot(peer).directory[0].appearance, custom);
  assert.deepEqual(office.snapshot(peer).peers[0].appearance, custom);
  store.addMessage(returned, 'general', 'Hello');
  assert.deepEqual(store.history('general')[0].appearance, custom);
  assert.throws(() => store.setAppearance(user.id, { ...custom, skin: 999 }));
  assert.deepEqual(store.member(user.id).appearance, custom);
});
test('guest customization is persisted only in their invitation session', (t) => {
  const store = createStore(':memory:');
  t.after(() => store.close());
  const member = store.upsertMember({ identity: 'test:host', name: 'Host' });
  const invite = store.createInvite('bloom', member.id);
  const token = store.newSession({
    guestName: 'Guest',
    guestId: 'guest-test',
    inviteId: invite.id,
  });
  store.setAppearance('guest-test', custom);
  assert.deepEqual(store.session(token).appearance, custom);
  assert.deepEqual(store.member(member.id).appearance, defaultAppearance(member.id));
  store.revokeInvite(invite.id, member.id);
  assert.equal(store.session(token), null);
});
test('existing accounts migrate additively and keep their identity and seat', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'assemble-appearance-'));
  const filename = join(folder, 'legacy.sqlite');
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE members (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT, role TEXT NOT NULL DEFAULT 'member', avatar TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', seat TEXT UNIQUE, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    INSERT INTO members VALUES('old','demo:old','Existing','', 'member','#b5a2de','focus','03',0,1);`);
  db.close();
  const store = createStore(filename);
  t.after(() => {
    store.close();
    assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
    rmSync(folder, { recursive: true, force: true });
  });
  const user = store.member('old');
  assert.equal(user.name, 'Existing');
  assert.equal(user.seat, '03');
  assert.equal(user.status, 'focus');
  assert.deepEqual(user.appearance, defaultAppearance('old'));
  store.setAppearance('old', custom);
  assert.deepEqual(store.member('old').appearance, custom);
});
