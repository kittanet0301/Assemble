import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolveAppearance, validAppearance } from '../shared/appearance.js';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export function createStore(filename, retentionDays = 30) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT, role TEXT NOT NULL DEFAULT 'member', avatar TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', seat TEXT UNIQUE, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, room_id TEXT NOT NULL, creator_id TEXT NOT NULL REFERENCES members(id), expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, member_id TEXT REFERENCES members(id), guest_name TEXT, guest_id TEXT, invite_id TEXT REFERENCES invites(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, channel TEXT NOT NULL, sender_id TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_channel_time ON messages(channel, created_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
  // Additive migrations retain existing accounts, sessions and chat history.
  for (const table of ['members', 'sessions', 'messages']) {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === 'appearance')
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN appearance TEXT`);
  }
  const publicMember = (row) =>
    row && {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatar: row.avatar,
      appearance: resolveAppearance(row.appearance, row.id),
      status: row.status,
      seat: row.seat,
      revoked: !!row.revoked,
    };
  return {
    db,
    members: () => db.prepare('SELECT * FROM members ORDER BY created_at').all().map(publicMember),
    member: (id) => publicMember(db.prepare('SELECT * FROM members WHERE id=?').get(id)),
    demoIdentity(name) {
      return db
        .prepare(
          "SELECT identity,name,role FROM members WHERE identity LIKE 'demo:%' ORDER BY created_at",
        )
        .all()
        .find(
          (m) => m.name.normalize('NFKC').toLowerCase() === name.normalize('NFKC').toLowerCase(),
        );
    },
    upsertMember({ identity, name, email = '', role = 'member', maxMembers = 50 }) {
      const existing = db.prepare('SELECT * FROM members WHERE identity=?').get(identity);
      if (existing?.revoked) throw new Error('บัญชีนี้ถูกถอนสิทธิ์แล้ว กรุณาติดต่อผู้ดูแล');
      if (existing) {
        db.prepare('UPDATE members SET name=?, email=?, role=? WHERE id=?').run(
          name,
          email,
          role,
          existing.id,
        );
        return this.member(existing.id);
      }
      if (db.prepare('SELECT count(*) AS n FROM members WHERE revoked=0').get().n >= maxMembers)
        throw new Error('สมาชิกครบจำนวนสำหรับกลุ่มทดลองแล้ว');
      const id = randomUUID(),
        colors = ['#e7af85', '#b5a2de', '#86bfae', '#e0bc64', '#94b7da', '#d99dba'];
      db.prepare(
        'INSERT INTO members(id,identity,name,email,role,avatar,created_at) VALUES(?,?,?,?,?,?,?)',
      ).run(
        id,
        identity,
        name,
        email,
        role,
        colors[db.prepare('SELECT count(*) AS n FROM members').get().n % colors.length],
        Date.now(),
      );
      return this.member(id);
    },
    setStatus(id, status) {
      db.prepare('UPDATE members SET status=? WHERE id=?').run(status, id);
    },
    setAppearance(id, appearance) {
      if (!validAppearance(appearance)) throw new Error('ตัวเลือกตัวละครไม่ถูกต้อง');
      const serialized = JSON.stringify(appearance);
      const result = db
        .prepare('UPDATE members SET appearance=? WHERE id=? AND revoked=0')
        .run(serialized, id);
      if (
        !result.changes &&
        !db.prepare('UPDATE sessions SET appearance=? WHERE guest_id=?').run(serialized, id).changes
      )
        throw new Error('ไม่พบผู้ใช้งาน');
      return resolveAppearance(appearance);
    },
    setSeat(id, seat) {
      const owner = db.prepare('SELECT id FROM members WHERE seat=? AND revoked=0').get(seat);
      if (owner && owner.id !== id)
        throw new Error('ที่นั่งนี้มีเจ้าของแล้ว เลือกที่นั่งอื่นได้เลย');
      db.prepare('UPDATE members SET seat=? WHERE id=?').run(seat, id);
    },
    revoke(id) {
      db.prepare('UPDATE members SET revoked=1,seat=NULL WHERE id=?').run(id);
      db.prepare('DELETE FROM sessions WHERE member_id=?').run(id);
      db.prepare('UPDATE invites SET revoked=1 WHERE creator_id=?').run(id);
    },
    newSession({
      memberId = null,
      guestName = null,
      guestId = null,
      inviteId = null,
      expiresAt = Date.now() + 12 * 3600_000,
    }) {
      const token = opaqueToken();
      db.prepare(
        'INSERT INTO sessions(token_hash,member_id,guest_name,guest_id,invite_id,expires_at) VALUES(?,?,?,?,?,?)',
      ).run(digest(token), memberId, guestName, guestId, inviteId, expiresAt);
      return token;
    },
    session(token, now = Date.now()) {
      if (!token) return null;
      const s = db
        .prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?')
        .get(digest(token), now);
      if (!s) return null;
      if (s.member_id) {
        const m = this.member(s.member_id);
        return m && !m.revoked ? { ...m, expiresAt: s.expires_at } : null;
      }
      const invite = db
        .prepare('SELECT * FROM invites WHERE id=? AND expires_at>? AND revoked=0')
        .get(s.invite_id, now);
      const creator = invite && this.member(invite.creator_id);
      if (!invite || !creator || creator.revoked) return null;
      return {
        id: s.guest_id,
        name: s.guest_name,
        role: 'guest',
        avatar: '#a1bac4',
        appearance: resolveAppearance(s.appearance, s.guest_id),
        status: 'available',
        seat: null,
        roomScope: invite.room_id,
        inviteId: invite.id,
        expiresAt: Math.min(s.expires_at, invite.expires_at),
      };
    },
    deleteSession(token) {
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
    },
    createInvite(roomId, creatorId, now = Date.now()) {
      const token = opaqueToken(),
        id = randomUUID(),
        expiresAt = now + 24 * 3600_000;
      db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,0)').run(
        id,
        digest(token),
        roomId,
        creatorId,
        expiresAt,
      );
      return { id, token, roomId, expiresAt };
    },
    invite(token, now = Date.now()) {
      const i = db
        .prepare('SELECT * FROM invites WHERE token_hash=? AND expires_at>? AND revoked=0')
        .get(digest(token), now);
      const creator = i && this.member(i.creator_id);
      return creator && !creator.revoked
        ? { id: i.id, roomId: i.room_id, expiresAt: i.expires_at }
        : null;
    },
    invites(creatorId, admin = false) {
      return admin
        ? db
            .prepare(
              'SELECT id,room_id AS roomId,creator_id AS creatorId,expires_at AS expiresAt,revoked FROM invites WHERE expires_at>?',
            )
            .all(Date.now())
        : db
            .prepare(
              'SELECT id,room_id AS roomId,creator_id AS creatorId,expires_at AS expiresAt,revoked FROM invites WHERE creator_id=? AND expires_at>?',
            )
            .all(creatorId, Date.now());
    },
    revokeInvite(id, creatorId, admin = false) {
      return db
        .prepare(`UPDATE invites SET revoked=1 WHERE id=? ${admin ? '' : 'AND creator_id=?'}`)
        .run(...(admin ? [id] : [id, creatorId])).changes;
    },
    history(channel) {
      return db
        .prepare(
          'SELECT id,channel,sender_id AS senderId,name,avatar,appearance,text,created_at AS createdAt FROM messages WHERE channel=? AND created_at>? ORDER BY created_at DESC LIMIT 80',
        )
        .all(channel, Date.now() - retentionDays * 86400_000)
        .reverse()
        .map((m) => ({ ...m, appearance: resolveAppearance(m.appearance, m.senderId) }));
    },
    addMessage(user, channel, text) {
      const m = {
        id: randomUUID(),
        channel,
        senderId: user.id,
        name: user.name,
        avatar: user.avatar,
        appearance: resolveAppearance(user.appearance, user.id),
        text,
        createdAt: Date.now(),
      };
      db.prepare(
        'INSERT INTO messages(id,channel,sender_id,name,avatar,text,created_at,appearance) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        m.id,
        channel,
        m.senderId,
        m.name,
        m.avatar,
        m.text,
        m.createdAt,
        JSON.stringify(m.appearance),
      );
      return m;
    },
    cleanup(now = Date.now()) {
      db.prepare('DELETE FROM messages WHERE created_at<?').run(now - retentionDays * 86400_000);
      db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
    },
    close() {
      db.close();
    },
  };
}
