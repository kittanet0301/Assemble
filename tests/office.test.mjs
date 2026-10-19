import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { Office } from '../server/office.mjs';
import {
  WORLD,
  ROOMS,
  DESKS,
  canStand,
  canStep,
  isGridPoint,
  snapToGrid,
  nextGridPoint,
  renderPosition,
  findPath,
  seatPosition,
} from '../shared/world.js';
import { sampleTimeline } from '../shared/motion.js';

function fixture(t, options = {}) {
  const store = createStore(':memory:');
  t.after(() => store.close());
  const office = new Office(store, options);
  let seq = 0;
  const connect = (role = 'member') => {
    const id = ++seq,
      messages = [],
      closes = [];
    const user = store.upsertMember({
      identity: `test:${id}`,
      name: `Member ${id}`,
      email: `m${id}@example.test`,
      role,
    });
    const token = store.newSession({ memberId: user.id });
    const peer = office.connect(
      user,
      (m) => messages.push(m),
      (...args) => closes.push(args),
      () => !!store.session(token),
    );
    return { user, peer, token, messages, closes };
  };
  return { store, office, connect };
}

test('all spawn points, room doors and seats are reachable without crossing furniture', () => {
  assert.ok(canStand(WORLD.spawn.x, WORLD.spawn.y));
  assert.ok(isGridPoint(WORLD.spawn));
  for (const target of [...ROOMS.map((r) => r.entry), ...DESKS.map((d) => seatPosition(d.id))]) {
    assert.ok(canStand(target.x, target.y));
    const path = findPath(WORLD.spawn, target);
    assert.ok(path.length > 0);
    let previous = WORLD.spawn;
    for (const step of path) {
      assert.ok(isGridPoint(step));
      assert.ok(canStep(previous, step));
      previous = step;
    }
  }
});
test('grid edges allow open diagonals but block thin walls and corner shortcuts', () => {
  const from = { x: 948, y: 132 },
    to = nextGridPoint(from, 1, 0);
  assert.equal(canStep(from, to), false);
  assert.equal(canStep(WORLD.spawn, { x: WORLD.spawn.x + 24, y: WORLD.spawn.y - 24 }), true);
  assert.equal(canStep({ x: 420, y: 348 }, { x: 444, y: 324 }), false);
  assert.equal(canStand(WORLD.spawn.x, 924), false);
  assert.deepEqual(nextGridPoint(WORLD.spawn, 1, -1), {
    x: WORLD.spawn.x + 24,
    y: WORLD.spawn.y - 24,
  });
  assert.deepEqual(findPath(WORLD.spawn, { x: 100, y: 120 }), []);
});
test('diagonal movement faces horizontally and keeps the same travel speed', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  for (const [dx, dy, facing] of [
    [-1, -1, 'left'],
    [1, -1, 'right'],
    [-1, 1, 'left'],
    [1, 1, 'right'],
  ]) {
    office.relocate(a.peer, WORLD.spawn);
    office.handle(a.peer, { type: 'move', dx, dy });
    assert.equal(a.peer.direction, facing);
    const motion = a.peer.motion;
    assert.ok(motion);
    assert.deepEqual(motion.to, {
      x: WORLD.spawn.x + dx * WORLD.step,
      y: WORLD.spawn.y + dy * WORLD.step,
    });
    assert.ok(
      Math.abs(motion.durationMs - ((Math.SQRT2 * WORLD.step) / WORLD.speed) * 1000) < 0.001,
    );
    const halfway = renderPosition(a.peer, motion.startedAt + motion.durationMs / 2);
    assert.ok(Math.abs(halfway.x - (WORLD.spawn.x + (dx * WORLD.step) / 2)) < 0.001);
    assert.ok(Math.abs(halfway.y - (WORLD.spawn.y + (dy * WORLD.step) / 2)) < 0.001);
    office.handle(a.peer, { type: 'move', dx: 0, dy: 0 });
    office.tick(0.1);
    office.tick(0.1);
    assert.equal(a.peer.motion, null);
    assert.deepEqual({ x: a.peer.x, y: a.peer.y }, motion.to);
  }
});
test('clicks snap to a grid center without appending a free-coordinate final step', () => {
  const target = { x: 831.5, y: 475.2 },
    path = findPath(WORLD.spawn, target);
  assert.ok(path.length);
  assert.deepEqual(path.at(-1), snapToGrid(target));
  assert.ok(path.every(isGridPoint));
  assert.deepEqual(findPath(WORLD.spawn, { x: WORLD.spawn.x + 2, y: WORLD.spawn.y - 3 }), []);
});
test('a quick tap between server ticks finishes exactly one cell', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.handle(a.peer, { type: 'move', dx: 1, dy: 0 });
  office.handle(a.peer, { type: 'move', dx: 0, dy: 0 });
  office.tick(0.05);
  assert.equal(a.peer.x, WORLD.spawn.x);
  assert.ok(a.peer.motion);
  const halfway = renderPosition(a.peer, office.time);
  assert.ok(halfway.x > WORLD.spawn.x && halfway.x < WORLD.spawn.x + WORLD.step);
  assert.equal(halfway.y, WORLD.spawn.y);
  office.tick(0.05);
  office.tick(0.05);
  assert.equal(a.peer.motion, null);
  assert.equal(a.peer.x, WORLD.spawn.x + WORLD.step);
  assert.equal(a.peer.y, WORLD.spawn.y);
  assert.ok(isGridPoint(a.peer));
  assert.equal(office.snapshot(a.peer).peers[0].moving, false);
});
test('changing direction midway finishes the current cell before turning', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.handle(a.peer, { type: 'move', dx: 1, dy: 0 });
  office.tick(0.075);
  office.handle(a.peer, { type: 'move', dx: 0, dy: 1 });
  const before = renderPosition(a.peer, office.time);
  assert.equal(before.y, WORLD.spawn.y);
  office.tick(0.05);
  assert.equal(a.peer.x, WORLD.spawn.x + WORLD.step);
  assert.equal(a.peer.y, WORLD.spawn.y);
  const after = renderPosition(a.peer, office.time);
  assert.equal(after.x, WORLD.spawn.x + WORLD.step);
  assert.ok(after.y > WORLD.spawn.y);
  assert.ok(canStep(a.peer.motion.from, a.peer.motion.to));
  office.handle(a.peer, { type: 'move', dx: 0, dy: 0 });
  office.tick(0.1);
  office.tick(0.1);
  assert.deepEqual(
    { x: a.peer.x, y: a.peer.y },
    { x: WORLD.spawn.x + WORLD.step, y: WORLD.spawn.y + WORLD.step },
  );
});
test('holding into a wall produces no drifting position or walking animation', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.relocate(a.peer, { x: 948, y: 132 });
  office.handle(a.peer, { type: 'move', dx: 1, dy: 0 });
  for (let i = 0; i < 40; i++) office.tick(0.025);
  assert.equal(a.peer.x, 948);
  assert.equal(a.peer.y, 132);
  assert.equal(a.peer.motion, null);
  assert.equal(office.snapshot(a.peer).peers[0].moving, false);
});
test('interpolation follows the actual grid corner and never cuts diagonally', () => {
  const samples = [
    {
      x: 12,
      y: 12,
      direction: 'right',
      serverTime: 0,
      motion: { from: { x: 12, y: 12 }, to: { x: 36, y: 12 }, startedAt: 0, durationMs: 100 },
    },
    {
      x: 36,
      y: 12,
      direction: 'down',
      serverTime: 150,
      motion: { from: { x: 36, y: 12 }, to: { x: 36, y: 36 }, startedAt: 100, durationMs: 100 },
    },
  ];
  assert.equal(sampleTimeline(samples, 90).y, 12);
  assert.equal(sampleTimeline(samples, 110).x, 36);
  assert.equal(sampleTimeline(samples, 90).direction, 'right');
  assert.equal(sampleTimeline(samples, 110).direction, 'down');
  assert.ok(Math.abs(sampleTimeline(samples, 110).y - 14.4) < 0.001);
  assert.equal(sampleTimeline(samples, 500).y, 36);
  assert.equal(sampleTimeline(samples, 500).moving, false);
  const teleport = [
    { x: 12, y: 12, serverTime: 0, motion: null },
    { x: 1020, y: 300, serverTime: 100, motion: null },
  ];
  assert.equal(sampleTimeline(teleport, 99).x, 12);
  assert.equal(sampleTimeline(teleport, 100).x, 1020);
});
test('timed-out input completes the current tile before stopping', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.handle(a.peer, { type: 'move', dx: -1, dy: 0 });
  a.peer.inputAt = Date.now() - 400;
  for (let i = 0; i < 10; i++) office.tick(0.025);
  assert.equal(a.peer.x, WORLD.spawn.x - WORLD.step);
  assert.equal(a.peer.motion, null);
  assert.ok(isGridPoint(a.peer));
});
test('walking through a door enters the next cell without teleporting to the room spawn', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.relocate(a.peer, { x: 948, y: 276 });
  office.handle(a.peer, { type: 'move', dx: 1, dy: 0 });
  office.handle(a.peer, { type: 'move', dx: 0, dy: 0 });
  for (let i = 0; i < 6; i++) office.tick(0.025);
  assert.equal(a.peer.roomId, 'bloom');
  assert.deepEqual({ x: a.peer.x, y: a.peer.y }, { x: 972, y: 276 });
});
test('an incoming grid step reserves the last room slot before another player enters', (t) => {
  const { office, connect } = fixture(t, { roomCapacity: 1 });
  const a = connect(),
    b = connect();
  office.relocate(a.peer, { x: 948, y: 252 });
  office.relocate(b.peer, { x: 948, y: 276 });
  office.handle(a.peer, { type: 'move', dx: 1, dy: 0 });
  office.handle(b.peer, { type: 'move', dx: 1, dy: 0 });
  assert.ok(a.peer.motion);
  assert.equal(b.peer.motion, null);
  assert.throws(() => office.join(b.peer, 'bloom'), /ครบ 1/);
  office.handle(a.peer, { type: 'move', dx: 0, dy: 0 });
  for (let i = 0; i < 6; i++) office.tick(0.025);
  assert.equal(office.occupancy('bloom').length, 1);
  assert.equal(b.peer.roomId, null);
  assert.equal(b.peer.x, 948);
});
test('two actual connected members see each other; offline directory is distinct from presence', (t) => {
  const { office, connect } = fixture(t);
  const a = connect(),
    b = connect();
  assert.equal(office.snapshot(a.peer).peers.length, 2);
  office.disconnect(b.peer);
  assert.equal(office.snapshot(a.peer).peers.length, 1);
  assert.equal(office.snapshot(a.peer).directory.length, 2);
});
test('room admits 8 members and rejects the ninth without changing their location', (t) => {
  const { office, connect } = fixture(t);
  const members = Array.from({ length: 9 }, () => connect());
  for (const m of members.slice(0, 8)) office.join(m.peer, 'bloom');
  assert.throws(() => office.join(members[8].peer, 'bloom'), /ครบ 8/);
  assert.equal(members[8].peer.roomId, null);
  assert.equal(office.occupancy('bloom').length, 8);
});
test('online limit is enforced at connection time', (t) => {
  const { connect } = fixture(t, { maxOnline: 2 });
  connect();
  connect();
  assert.throws(() => connect(), /ออฟฟิศเต็ม/);
});
test('guest invitation expires after 24 hours and accepted guest loses access when revoked', (t) => {
  const { store, connect } = fixture(t);
  const host = connect();
  const now = Date.now();
  const invite = store.createInvite('bloom', host.user.id, now);
  assert.equal(invite.expiresAt - now, 86400_000);
  assert.ok(store.invite(invite.token, invite.expiresAt - 1));
  assert.equal(store.invite(invite.token, invite.expiresAt), null);
  const guestToken = store.newSession({
    guestId: 'guest-one',
    guestName: 'Visitor',
    inviteId: invite.id,
    expiresAt: invite.expiresAt,
  });
  assert.equal(store.session(guestToken).roomScope, 'bloom');
  assert.equal(store.revokeInvite(invite.id, host.user.id), 1);
  assert.equal(store.session(guestToken), null);
});
test('guest cannot read general chat, switch rooms, move outside, reserve a desk or change status', (t) => {
  const { store, office, connect } = fixture(t);
  const host = connect();
  const invite = store.createInvite('bloom', host.user.id),
    token = store.newSession({ guestId: 'guest-two', guestName: 'Visitor', inviteId: invite.id });
  const guest = store.session(token),
    events = [];
  const peer = office.connect(
    guest,
    (m) => events.push(m),
    () => {},
    () => !!store.session(token),
  );
  assert.throws(() => office.handle(peer, { type: 'history', channel: 'general' }), /ไม่มีสิทธิ์/);
  assert.throws(
    () => office.handle(peer, { type: 'chat', channel: 'orbit', text: 'leak' }),
    /เข้าห้องก่อน/,
  );
  assert.throws(() => office.join(peer, 'orbit'), /ไม่มีสิทธิ์/);
  assert.throws(() => office.leave(peer), /เฉพาะห้อง/);
  const position = { x: peer.x, y: peer.y };
  for (const message of [
    { type: 'move', dx: -1, dy: 1 },
    { type: 'walk', x: 672, y: 456 },
    { type: 'seat', seat: '01' },
    { type: 'status', status: 'focus' },
  ])
    office.handle(peer, message);
  office.tick(0.05);
  assert.deepEqual({ x: peer.x, y: peer.y }, position);
  assert.equal(peer.user.status, 'available');
  assert.equal(peer.user.seat, null);
  assert.equal(office.snapshot(peer).directory.length, 0);
  assert.ok(office.snapshot(peer).peers.every((p) => p.roomId === 'bloom'));
});
test('room chat is delivered only to occupants and persists for an authorized later join', (t) => {
  const { office, connect } = fixture(t);
  const a = connect(),
    b = connect(),
    outside = connect();
  office.join(a.peer, 'bloom');
  office.join(b.peer, 'bloom');
  office.handle(a.peer, { type: 'chat', channel: 'bloom', text: 'Hello team' });
  assert.ok(b.messages.some((m) => m.type === 'chat' && m.message.text === 'Hello team'));
  assert.ok(!outside.messages.some((m) => m.type === 'chat'));
  office.join(outside.peer, 'bloom');
  assert.ok(
    outside.messages.at(-2)?.type === 'history' ||
      outside.messages.some((m) => m.type === 'history' && m.messages.length === 1),
  );
});
test('desk reservation is exclusive and revocation releases it', (t) => {
  const { store, office, connect } = fixture(t);
  const a = connect(),
    b = connect();
  office.handle(a.peer, { type: 'seat', seat: '01' });
  assert.throws(() => office.handle(b.peer, { type: 'seat', seat: '01' }), /มีเจ้าของ/);
  office.handle(a.peer, { type: 'myseat' });
  assert.equal(a.peer.x, seatPosition('01').x);
  store.revoke(a.user.id);
  office.tick(0);
  assert.equal(office.peers.has(a.user.id), false);
  assert.doesNotThrow(() => office.handle(b.peer, { type: 'seat', seat: '01' }));
});
test('revoking a member invalidates sessions and their previously accepted guest invitations', (t) => {
  const { store, office, connect } = fixture(t);
  const host = connect();
  const invite = store.createInvite('bloom', host.user.id);
  const guest = store.newSession({
    guestId: 'guest-three',
    guestName: 'Visitor',
    inviteId: invite.id,
  });
  store.revoke(host.user.id);
  office.tick(0);
  assert.equal(store.session(host.token), null);
  assert.equal(store.session(guest), null);
  assert.equal(store.invite(invite.token), null);
  assert.ok(host.closes.length > 0);
});
test('leaving a room requests removal from the matching media room', (t) => {
  const removals = [];
  const { office, connect } = fixture(t, {
    removeMediaParticipant: (...args) => removals.push(args),
  });
  const a = connect();
  office.join(a.peer, 'bloom');
  office.leave(a.peer);
  assert.deepEqual(removals, [['bloom', a.user.id]]);
});
test('chat retention hides and purges expired messages', (t) => {
  const { store, connect } = fixture(t);
  const a = connect();
  const old = store.addMessage(a.user, 'general', 'expired');
  store.db
    .prepare('UPDATE messages SET created_at=? WHERE id=?')
    .run(Date.now() - 31 * 86400_000, old.id);
  store.addMessage(a.user, 'general', 'current');
  assert.deepEqual(
    store.history('general').map((m) => m.text),
    ['current'],
  );
  store.cleanup();
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n, 1);
});
test('prototype status names and non-finite movement are rejected', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.handle(a.peer, { type: 'status', status: '__proto__' });
  office.handle(a.peer, { type: 'move', dx: Infinity, dy: NaN });
  office.tick(0.05);
  assert.equal(a.peer.user.status, 'available');
  assert.equal(a.peer.x, WORLD.spawn.x);
  assert.equal(office.visibleChannel(a.peer, null), false);
});
test('click-to-walk reaches the meeting door and joins through server room rules', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  office.handle(a.peer, { type: 'walk', ...ROOMS[0].entry });
  for (let i = 0; i < 400; i++) {
    office.tick(0.05);
    assert.ok(canStand(a.peer.x, a.peer.y));
  }
  assert.equal(a.peer.roomId, 'bloom');
  assert.equal(a.peer.path.length, 0);
});
test('a second connection replaces its previous socket without losing the new presence', (t) => {
  const { office, connect } = fixture(t);
  const a = connect();
  const replacement = office.connect(
    a.user,
    () => {},
    () => {},
    () => true,
  );
  office.disconnect(a.peer);
  assert.equal(office.peers.get(a.user.id), replacement);
  assert.equal(a.closes[0][0], 4001);
});
