import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { WebSocket } from 'ws';
import { previewConfig } from '../server/preview.mjs';

test('tunnel preview requires an explicit HTTPS origin and a strong password', () => {
  const password = randomBytes(18).toString('hex');
  for (const origin of [
    'http://office.test',
    'https://office.test/path',
    'https://u:p@office.test',
    'https://office.test/?x=1',
  ])
    assert.throws(() => previewConfig({ PREVIEW_ORIGIN: origin, PREVIEW_PASSWORD: password }));
  assert.throws(() =>
    previewConfig({ PREVIEW_ORIGIN: 'https://office.test', PREVIEW_PASSWORD: 'short' }),
  );
  assert.equal(
    previewConfig({ PREVIEW_ORIGIN: 'https://office.test/', PREVIEW_PASSWORD: password }).origin,
    'https://office.test',
  );
});

test(
  'ngrok preview serves the built app and protects HTTP, login and WebSockets',
  { timeout: 30000 },
  async (t) => {
    const temporary = await mkdtemp(join(tmpdir(), 'assemble-preview-test-'));
    const listener = createServer();
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const origin = 'https://nearby-awning-outing.ngrok-free.dev';
    const password = randomBytes(18).toString('base64url');
    const server = spawn(process.execPath, ['server/index.mjs', '--preview'], {
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        PREVIEW_ORIGIN: origin,
        PREVIEW_PASSWORD: password,
        PREVIEW_DATA_FILE: join(temporary, 'preview.sqlite'),
        DATA_FILE: join(temporary, 'office.sqlite'),
        PUBLIC_ORIGIN: 'http://localhost:4173',
        AUTH_MODE: 'oidc',
        SESSION_SECRET: randomBytes(32).toString('hex'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    server.stdout.on('data', (data) => (output += data));
    server.stderr.on('data', (data) => (output += data));
    const sockets = [];
    t.after(async () => {
      sockets.forEach((socket) => socket.terminate());
      if (server.exitCode === null && server.signalCode === null) {
        const stopped = new Promise((resolve) => server.once('exit', resolve));
        server.kill();
        await stopped;
      }
      assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
      assert.ok(basename(temporary).startsWith('assemble-preview-test-'));
      await rm(temporary, { recursive: true, force: true });
    });
    const request = (path, options = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, {
        ...options,
        headers: { Host: new URL(origin).host, ...options.headers },
        redirect: 'manual',
      });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await request('/')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    assert.match(await (await request('/')).text(), /Team preview/);
    for (const path of ['/api/config', '/api/me', '/server/index.mjs', '/.env'])
      assert.equal((await request(path)).status, 401);
    const unlock = (value, from = origin, next = '/') =>
      request('/__preview/login', {
        method: 'POST',
        headers: { Origin: from, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: value, next }),
      });
    assert.equal((await unlock(password, 'https://other.test')).status, 403);
    assert.equal((await unlock('wrong-password')).status, 401);
    const granted = await unlock(password, origin, '//other.test');
    assert.equal(granted.status, 303);
    assert.equal(granted.headers.get('location'), '/');
    const gateCookie = granted.headers.get('set-cookie').split(';')[0];
    assert.match(granted.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(granted.headers.get('set-cookie'), /Secure/i);
    const app = await request('/', { headers: { Cookie: gateCookie } });
    assert.equal(app.status, 200);
    const html = await app.text();
    assert.match(html, /<script[^>]+\/assets\//);
    assert.doesNotMatch(html, /Blocked request|@vite\/client/);
    const config = await (await request('/api/config', { headers: { Cookie: gateCookie } })).json();
    assert.equal(config.preview, true);
    assert.equal(config.demo, true);
    const login = (from) =>
      request('/api/auth/demo', {
        method: 'POST',
        headers: { Origin: from, Cookie: gateCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tunnel tester' }),
      });
    assert.equal((await login('http://localhost:4173')).status, 403);
    const loggedIn = await login(origin);
    assert.equal(loggedIn.status, 200);
    const user = (await loggedIn.json()).user;
    const officeCookie = loggedIn.headers.get('set-cookie').split(';')[0];
    const cookie = gateCookie + '; ' + officeCookie;
    assert.equal(
      (await (await request('/api/me', { headers: { Cookie: cookie } })).json()).user.id,
      user.id,
    );
    assert.equal((await request('/api/me', { headers: { Cookie: officeCookie } })).status, 401);
    assert.equal((await request('/api/me', { headers: { Cookie: gateCookie + 'x' } })).status, 401);
    const rejected = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin,
      headers: { Cookie: officeCookie },
    });
    sockets.push(rejected);
    rejected.on('error', () => {});
    const rejectedStatus = await new Promise((resolve, reject) => {
      rejected.once('open', () => reject(new Error('WebSocket bypassed preview gate')));
      rejected.once('unexpected-response', (_req, res) => {
        resolve(res.statusCode);
        res.resume();
      });
    });
    assert.equal(rejectedStatus, 401);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin,
      headers: { Cookie: cookie },
    });
    sockets.push(socket);
    const snapshot = await new Promise((resolve, reject) => {
      socket.on('error', reject);
      socket.on('message', (raw) => {
        const data = JSON.parse(raw);
        if (data.type === 'snapshot') resolve(data);
      });
    });
    assert.equal(snapshot.selfId, user.id);
    const chat = new Promise((resolve) =>
      socket.on('message', (raw) => {
        const data = JSON.parse(raw);
        if (data.type === 'chat') resolve(data.message);
      }),
    );
    socket.send(JSON.stringify({ type: 'chat', channel: 'general', text: 'Tunnel works' }));
    assert.equal((await chat).text, 'Tunnel works');
    const invitationTarget = await unlock(password, origin, '/?invite=preview-token');
    assert.equal(invitationTarget.headers.get('location'), '/?invite=preview-token');
  },
);
