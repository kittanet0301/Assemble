import express from 'express';
import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createStore } from './store.mjs';
import { installAuth } from './auth.mjs';
import { Office } from './office.mjs';
import { ROOMS } from '../shared/world.js';
import { validAppearance } from '../shared/appearance.js';
import { installPreviewGate, previewConfig } from './preview.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const production = process.argv.includes('--production');
const preview = process.argv.includes('--preview');
if (preview && production) throw new Error('เลือก --preview หรือ --production อย่างใดอย่างหนึ่ง');
const previewSettings = preview ? previewConfig(process.env) : null;
const number = (key, fallback, max) =>
  Math.max(1, Math.min(max, Number.parseInt(process.env[key] ?? String(fallback), 10) || fallback));
const config = {
  port: number('PORT', 4173, 65535),
  host: process.env.HOST ?? '127.0.0.1',
  origin: previewSettings?.origin ?? process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173',
  officeName: process.env.OFFICE_NAME ?? 'Assemble HQ',
  orgName: process.env.ORG_NAME ?? 'Assemble',
  demo: preview || (!production && (process.env.AUTH_MODE ?? 'demo') === 'demo'),
  preview,
  domains: (process.env.ALLOWED_DOMAINS ?? '')
    .toLowerCase()
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .toLowerCase()
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  maxMembers: number('MAX_MEMBERS', 50, 50),
  maxOnline: number('MAX_ONLINE', 20, 20),
  roomCapacity: number('ROOM_CAPACITY', 8, 8),
  retention: number('CHAT_RETENTION_DAYS', 30, 30),
  mediaEnabled: !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  ),
};
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
if (
  config.demo &&
  (!['127.0.0.1', 'localhost', '::1'].includes(config.host) ||
    (!preview && !localHosts.has(new URL(config.origin).hostname)))
)
  throw new Error('โหมดเดโมเปิดได้เฉพาะ loopback เท่านั้น');
if (
  production &&
  (!config.domains.length ||
    !config.adminEmails.length ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    !config.origin.startsWith('https:'))
)
  throw new Error(
    'Production ต้องกำหนด HTTPS PUBLIC_ORIGIN, ALLOWED_DOMAINS, ADMIN_EMAILS และ SESSION_SECRET อย่างน้อย 32 ตัวอักษร',
  );
const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const signature = (token) => createHmac('sha256', secret).update(token).digest('base64url');
const sessionToken = (req) => {
  const raw = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('office_session='))
    ?.slice(15);
  if (!raw || raw.length > 200) return null;
  const [token, supplied] = raw.split('.'),
    expected = signature(token ?? '');
  return supplied &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ? token
    : null;
};
if (preview && !existsSync('dist/index.html'))
  throw new Error('กรุณารัน pnpm build ก่อนเปิดพรีวิว');
const dataFile = preview
  ? (process.env.PREVIEW_DATA_FILE ?? 'data/tunnel-preview.sqlite')
  : (process.env.DATA_FILE ?? 'data/office.sqlite');
if (preview && resolve(dataFile) === resolve(process.env.DATA_FILE ?? 'data/office.sqlite'))
  throw new Error('พรีวิวต้องใช้ฐานข้อมูลแยกจากสำนักงาน');
const store = createStore(resolve(dataFile), config.retention);
store.cleanup();
const app = express(),
  server = createServer(app);
app.disable('x-powered-by');
const previewGate = preview ? installPreviewGate(app, { ...previewSettings, secret }) : null;
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/'))
    res.setHeader('Cache-Control', 'no-store');
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
const allowedOrigins = new Set([
  config.origin,
  ...(config.demo && !preview
    ? [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`]
    : []),
]);
const verifyOrigin = (req, res, next) => {
  if (!allowedOrigins.has(req.headers.origin) || !req.is('application/json'))
    return res.status(403).json({ error: 'คำขอไม่มาจากเว็บไซต์ขององค์กร' });
  next();
};
const rate = new Map();
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') {
    const key = req.socket.remoteAddress,
      now = Date.now(),
      entry = rate.get(key);
    if (!entry || entry.until < now) rate.set(key, { count: 1, until: now + 60_000 });
    else if (++entry.count > 120)
      return res.status(429).json({ error: 'คำขอมากเกินไป กรุณารอสักครู่' });
    if (rate.size > 2000) for (const [k, v] of rate) if (v.until < now) rate.delete(k);
  }
  next();
});
app.use(express.json({ limit: '12kb' }));
const sessionCookie = (res, token, maxAge = 12 * 3600_000) =>
  res.cookie('office_session', `${token}.${signature(token)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.origin.startsWith('https:'),
    path: '/',
    maxAge,
  });
const getUser = (req) => {
  req.sessionToken = sessionToken(req);
  return store.session(req.sessionToken);
};
const requireUser = (req, res, next) => {
  req.user = getUser(req);
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ออฟฟิศอีกครั้ง' });
  next();
};
const requireMember = (req, res, next) =>
  req.user.role === 'guest'
    ? res.status(403).json({ error: 'สำหรับสมาชิกองค์กรเท่านั้น' })
    : next();
installAuth(app, { store, config, sessionCookie, getUser, verifyOrigin });
const mediaAdmin = config.mediaEnabled
  ? new RoomServiceClient(
      process.env.LIVEKIT_URL.replace(/^ws/, 'http'),
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    )
  : null;
const removeMediaParticipant = async (roomId, identity) => {
  if (mediaAdmin)
    try {
      await mediaAdmin.removeParticipant(`assemble-${roomId}`, identity);
    } catch {
      /* participant may already be disconnected */
    }
};
const office = new Office(store, { ...config, removeMediaParticipant });
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/me', (req, res) => res.json({ user: getUser(req) }));
app.post('/api/me/appearance', verifyOrigin, requireUser, (req, res) => {
  if (!validAppearance(req.body.appearance))
    return res.status(400).json({ error: 'ตัวเลือกตัวละครไม่ถูกต้อง กรุณาเลือกใหม่' });
  const appearance = store.setAppearance(req.user.id, req.body.appearance);
  const peer = office.peers.get(req.user.id);
  if (peer) peer.user.appearance = appearance;
  office.broadcast();
  res.json({ appearance });
});
app.get('/api/invites/preview', (req, res) => {
  const invite = typeof req.query.token === 'string' && store.invite(req.query.token);
  if (!invite) return res.status(410).json({ error: 'คำเชิญหมดอายุหรือถูกยกเลิกแล้ว' });
  res.json({
    room: ROOMS.find((r) => r.id === invite.roomId),
    expiresAt: invite.expiresAt,
    orgName: config.orgName,
  });
});
app.post('/api/invites/accept', verifyOrigin, (req, res) => {
  const invite = typeof req.body.token === 'string' && store.invite(req.body.token),
    name = typeof req.body.name === 'string' && req.body.name.trim().slice(0, 40);
  if (!invite) return res.status(410).json({ error: 'คำเชิญหมดอายุหรือถูกยกเลิกแล้ว' });
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อของคุณ' });
  sessionCookie(
    res,
    store.newSession({
      guestId: `guest-${randomUUID()}`,
      guestName: name,
      inviteId: invite.id,
      expiresAt: invite.expiresAt,
    }),
    invite.expiresAt - Date.now(),
  );
  res.json({ ok: true });
});
app.get('/api/invites', requireUser, requireMember, (req, res) =>
  res.json({ invites: store.invites(req.user.id, req.user.role === 'admin') }),
);
app.post('/api/invites', verifyOrigin, requireUser, requireMember, (req, res) => {
  if (!ROOMS.some((r) => r.id === req.body.roomId))
    return res.status(400).json({ error: 'ไม่พบห้องประชุม' });
  const invite = store.createInvite(req.body.roomId, req.user.id);
  res.json({
    id: invite.id,
    expiresAt: invite.expiresAt,
    url: `${config.origin}/?invite=${invite.token}`,
  });
});
app.delete('/api/invites/:id', verifyOrigin, requireUser, requireMember, (req, res) => {
  if (!store.revokeInvite(req.params.id, req.user.id, req.user.role === 'admin'))
    return res.status(404).json({ error: 'ไม่พบคำเชิญของคุณ' });
  office.tick(0);
  res.json({ ok: true });
});
app.post('/api/members/:id/revoke', verifyOrigin, requireUser, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลเท่านั้น' });
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'ผู้ดูแลถอนสิทธิ์ตัวเองไม่ได้' });
  if (!store.member(req.params.id)) return res.status(404).json({ error: 'ไม่พบสมาชิก' });
  store.revoke(req.params.id);
  office.tick(0);
  office.broadcast();
  res.json({ ok: true });
});
app.post('/api/meeting/token', verifyOrigin, requireUser, async (req, res) => {
  const peer = office.peers.get(req.user.id);
  if (!peer?.roomId || peer.roomId !== req.body.roomId)
    return res.status(403).json({ error: 'เข้าห้องประชุมก่อนเปิดอุปกรณ์' });
  if (!config.mediaEnabled)
    return res.status(503).json({
      error:
        'ยังไม่ได้เชื่อมบริการประชุม ผู้ดูแลต้องตั้งค่า LiveKit ก่อนเปิดไมค์ กล้อง และแชร์หน้าจอ',
    });
  try {
    // A bounded lifetime plus forced removal on leave/revocation limits stale access.
    const ttl = Math.max(1, Math.min(60, Math.floor((req.user.expiresAt - Date.now()) / 1000)));
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: req.user.id,
      name: req.user.name,
      ttl,
    });
    token.addGrant({
      roomJoin: true,
      room: `assemble-${peer.roomId}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomRecord: false,
      roomAdmin: false,
    });
    await mediaAdmin.createRoom({
      name: `assemble-${peer.roomId}`,
      maxParticipants: config.roomCapacity,
      emptyTimeout: 60,
    });
    res.json({ token: await token.toJwt(), url: process.env.LIVEKIT_URL });
  } catch {
    res.status(502).json({ error: 'เชื่อมบริการประชุมไม่ได้ กรุณาตรวจ LiveKit ขององค์กร' });
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, config.origin).pathname !== '/ws') return;
  const token = sessionToken(req),
    user = store.session(token);
  if (
    !allowedOrigins.has(req.headers.origin) ||
    !user ||
    (previewGate && !previewGate.authorized(req))
  ) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const send = (payload) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    };
    let peer;
    try {
      peer = office.connect(
        user,
        send,
        (code, text) => ws.close(code, text),
        () => !!store.session(token) && (!previewGate || previewGate.authorized(req)),
      );
    } catch (e) {
      send({ type: 'error', text: e.message });
      ws.close(4004, e.message);
      return;
    }
    send({
      type: 'history',
      channel: user.role === 'guest' ? user.roomScope : 'general',
      messages: store.history(user.role === 'guest' ? user.roomScope : 'general'),
    });
    let windowStart = Date.now(),
      count = 0;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (raw) => {
      if (Date.now() - windowStart > 1000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 50) {
        ws.close(4008, 'ส่งคำขอเร็วเกินไป');
        return;
      }
      try {
        const message = JSON.parse(raw.toString());
        if (!message || typeof message !== 'object') return;
        office.handle(peer, message);
      } catch (e) {
        send({
          type: 'error',
          text: e instanceof SyntaxError ? 'รูปแบบข้อความไม่ถูกต้อง' : e.message,
        });
      }
    });
    ws.on('close', () => office.disconnect(peer));
    ws.on('error', () => office.disconnect(peer));
  });
});
let lastMovementTick = performance.now();
const timers = [
  setInterval(() => {
    const now = performance.now();
    office.tick((now - lastMovementTick) / 1000);
    lastMovementTick = now;
  }, 25),
  setInterval(() => office.broadcast(), 50),
  setInterval(() => store.cleanup(), 3600_000),
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) ws.terminate();
      else {
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30_000),
];
if (production || preview) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server }, allowedHosts: ['localhost', '127.0.0.1'] },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
});
server.listen(config.port, config.host, () =>
  console.log(
    `\n  Assemble Office\n  Local: http://localhost:${config.port}\n  ${preview ? `Protected team preview: ${config.origin}` : config.demo ? 'Local demo · corporate sign-in is not connected' : 'Organization authentication'}\n`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    for (const t of timers) clearInterval(t);
    wss.close();
    server.close();
    store.close();
    process.exit(0);
  });
