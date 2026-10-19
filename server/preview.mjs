import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';

export function previewConfig(env) {
  const url = new URL(env.PREVIEW_ORIGIN ?? '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('PREVIEW_ORIGIN ต้องเป็น HTTPS origin เช่น https://your-domain.ngrok-free.dev');
  if (!env.PREVIEW_PASSWORD || env.PREVIEW_PASSWORD.length < 16)
    throw new Error('PREVIEW_PASSWORD ต้องมีอย่างน้อย 16 ตัวอักษร');
  return { origin: url.origin, password: env.PREVIEW_PASSWORD };
}

const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
const hash = (value) => createHash('sha256').update(value).digest();
const cookieName = 'assemble_preview';
const duration = 4 * 60 * 60 * 1000;

export function installPreviewGate(app, { origin, password, secret }) {
  // A restart or a password change invalidates existing preview access cookies.
  const key = createHmac('sha256', secret).update(password).digest();
  const sign = (value) => createHmac('sha256', key).update(value).digest('base64url');
  const authorized = (req) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    if (!cookie || cookie.length > 100) return false;
    const [expires, supplied] = cookie.split('.');
    if (!/^\d+$/.test(expires ?? '') || Number(expires) <= Date.now()) return false;
    const expected = sign(expires);
    return (
      !!supplied &&
      Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    );
  };
  let failures = 0,
    resetAt = 0;
  const page = (
    next,
    failed = false,
  ) => `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assemble — พรีวิวสำหรับทีม</title>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f3f2f8;color:#383140;font:15px system-ui,sans-serif}main{width:min(340px,calc(100vw - 80px));padding:32px;background:white;border:1px solid #e8e2ef;border-radius:18px}h1{font-size:23px;margin:0 0 12px}p{color:#7c7187;font-size:13px;line-height:1.8}label{display:block;margin:22px 0 8px;font-size:13px}input,button{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddd5e8;border-radius:8px;font:inherit}button{margin-top:14px;background:#7154e8;color:white;border:0;cursor:pointer}.error{color:#ac3f55}</style>
<main><h1>Assemble · Team preview</h1><p>ใส่รหัสพรีวิวที่ผู้เปิดเซิร์ฟเวอร์ส่งให้<br>พื้นที่นี้ใช้บัญชีทดลอง แยกจากข้อมูลสำนักงานจริง</p>${failed ? '<p class="error" role="alert">รหัสไม่ถูกต้อง กรุณาลองอีกครั้ง</p>' : ''}<form method="post" action="/__preview/login"><input type="hidden" name="next" value="${escapeHtml(next)}"><label for="password">รหัสเข้าพรีวิว</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button>เข้าพรีวิว</button></form></main></html>`;
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
    );
    next();
  });
  app.post(
    '/__preview/login',
    express.urlencoded({ extended: false, limit: '2kb' }),
    (req, res) => {
      if (req.headers.origin !== origin) return res.status(403).send('Origin not allowed');
      if (Date.now() > resetAt) {
        failures = 0;
        resetAt = Date.now() + 60_000;
      }
      if (failures >= 10)
        return res.status(429).set('Retry-After', '60').send('กรุณารอ 1 นาทีแล้วลองใหม่');
      const next =
        typeof req.body.next === 'string' &&
        req.body.next.startsWith('/') &&
        !req.body.next.startsWith('//') &&
        !/[\\\r\n]/.test(req.body.next)
          ? req.body.next
          : '/';
      if (
        typeof req.body.password !== 'string' ||
        !timingSafeEqual(hash(req.body.password), hash(password))
      ) {
        failures++;
        return res.status(401).type('html').send(page(next, true));
      }
      const expires = String(Date.now() + duration);
      res.cookie(cookieName, `${expires}.${sign(expires)}`, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: duration,
      });
      res.redirect(303, next);
    },
  );
  app.use((req, res, next) => {
    if (authorized(req)) return next();
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/auth/'))
      return res.status(401).type('html').send(page(req.originalUrl));
    res.status(401).json({ error: 'กรุณาใส่รหัสเข้าพรีวิวก่อน' });
  });
  return { authorized };
}
