import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { WebSocket } from 'ws';

test(
  'HTTP sessions, CSRF protection, websocket authentication and admin revocation',
  { timeout: 30000 },
  async (t) => {
    const temporary = await mkdtemp(join(tmpdir(), 'assemble-test-'));
    const port = 14173,
      origin = `http://localhost:${port}`;
    const server = spawn(process.execPath, ['server/index.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        PUBLIC_ORIGIN: origin,
        HOST: '127.0.0.1',
        AUTH_MODE: 'demo',
        DATA_FILE: join(temporary, 'test.sqlite'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    server.stdout.on('data', (data) => {
      output += data;
    });
    server.stderr.on('data', (data) => {
      output += data;
    });
    const sockets = [];
    t.after(async () => {
      for (const socket of sockets) socket.terminate();
      if (server.exitCode === null && server.signalCode === null) {
        const stopped = new Promise((resolve) => server.once('exit', resolve));
        server.kill();
        await stopped;
      }
      assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
      assert.ok(basename(temporary).startsWith('assemble-test-'));
      await rm(temporary, { recursive: true, force: true });
    });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + '/api/health')).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const post = (path, body, cookie, from = origin) =>
      fetch(origin + path, {
        method: 'POST',
        headers: {
          Origin: from,
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post('/api/auth/demo', { name: 'Forged' }, null, 'https://other.test')).status,
      403,
    );
    const login = await post('/api/auth/demo', { name: 'Admin' });
    assert.equal(login.status, 200, output);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(login.headers.get('set-cookie'), /SameSite=Lax/i);
    const admin = (await login.json()).user;
    assert.equal(admin.role, 'admin');
    const returningLogin = await post('/api/auth/demo', { name: 'Admin' });
    const returningAdmin = (await returningLogin.json()).user;
    assert.equal(returningAdmin.id, admin.id);
    assert.equal(returningAdmin.role, 'admin');
    const memberLogin = await post('/api/auth/demo', { name: 'Member' }),
      member = (await memberLogin.json()).user,
      memberCookie = memberLogin.headers.get('set-cookie').split(';')[0];
    const me = await fetch(origin + '/api/me', { headers: { Cookie: cookie } });
    assert.equal((await me.json()).user.id, admin.id);
    const tampered = await fetch(origin + '/api/me', { headers: { Cookie: cookie + 'x' } });
    assert.equal((await tampered.json()).user, null);
    assert.equal((await post(`/api/members/${admin.id}/revoke`, {}, memberCookie)).status, 403);
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      origin,
      headers: { Cookie: memberCookie },
    });
    sockets.push(ws);
    const snapshots = [];
    ws.on('message', (b) => snapshots.push(JSON.parse(b.toString())));
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.ok(snapshots.some((m) => m.type === 'snapshot' && m.selfId === member.id));
    const appearance = {
      skin: 2,
      hairStyle: 3,
      hairColor: 1,
      shirtStyle: 2,
      shirtColor: 4,
      pantsColor: 3,
    };
    assert.equal((await post('/api/me/appearance', { appearance }, null)).status, 401);
    assert.equal(
      (await post('/api/me/appearance', { appearance }, memberCookie, 'https://other.test')).status,
      403,
    );
    assert.equal(
      (await post('/api/me/appearance', { appearance: { ...appearance, skin: 999 } }, memberCookie))
        .status,
      400,
    );
    assert.equal((await post('/api/me/appearance', { appearance }, memberCookie)).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(
      snapshots
        .filter((s) => s.type === 'snapshot')
        .at(-1)
        .peers.find((p) => p.id === member.id).appearance,
      appearance,
    );
    assert.deepEqual(
      (await (await fetch(origin + '/api/me', { headers: { Cookie: memberCookie } })).json()).user
        .appearance,
      appearance,
    );
    const observer = new WebSocket(`ws://localhost:${port}/ws`, {
      origin,
      headers: { Cookie: cookie },
    });
    sockets.push(observer);
    const observerMessages = [];
    observer.on('message', (b) => observerMessages.push(JSON.parse(b.toString())));
    await new Promise((resolve, reject) => {
      observer.once('open', resolve);
      observer.once('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(
      observerMessages.find((m) => m.type === 'snapshot').peers.find((p) => p.id === member.id)
        .appearance,
      appearance,
    );
    ws.send(JSON.stringify({ type: 'join', roomId: 'bloom' }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const unavailable = await post('/api/meeting/token', { roomId: 'bloom' }, memberCookie);
    assert.equal(unavailable.status, 503);
    const inviteResult = await post('/api/invites', { roomId: 'bloom' }, cookie),
      invite = await inviteResult.json();
    assert.equal(inviteResult.status, 200);
    const invitationToken = new URL(invite.url).searchParams.get('invite');
    const accepted = await post('/api/invites/accept', { name: 'Visitor', token: invitationToken });
    assert.equal(accepted.status, 200);
    const guestCookie = accepted.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/me/appearance', { appearance }, guestCookie)).status, 200);
    assert.deepEqual(
      (await (await fetch(origin + '/api/me', { headers: { Cookie: guestCookie } })).json()).user
        .appearance,
      appearance,
    );
    assert.equal((await post('/api/invites', { roomId: 'orbit' }, guestCookie)).status, 403);
    assert.equal((await post('/api/meeting/token', { roomId: 'orbit' }, guestCookie)).status, 403);
    const closed = new Promise((resolve) => ws.once('close', (code) => resolve(code)));
    assert.equal((await post(`/api/members/${member.id}/revoke`, {}, cookie)).status, 200);
    assert.equal(await closed, 4003);
    assert.equal(
      (await (await fetch(origin + '/api/me', { headers: { Cookie: memberCookie } })).json()).user,
      null,
    );
    assert.equal((await post(`/api/members/${admin.id}/revoke`, {}, cookie)).status, 400);
  },
);
