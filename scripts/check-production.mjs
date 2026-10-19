import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporary = await mkdtemp(join(tmpdir(), 'assemble-production-'));
const listener = createServer();
await new Promise((resolve, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', resolve);
});
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.mjs', '--production'], {
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    PUBLIC_ORIGIN: 'https://office.example.test',
    AUTH_MODE: 'oidc',
    ALLOWED_DOMAINS: 'example.test',
    ADMIN_EMAILS: 'admin@example.test',
    SESSION_SECRET: randomBytes(32).toString('hex'),
    DATA_FILE: join(temporary, 'office.sqlite'),
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
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(`${origin}/api/health`)).ok;
      if (ready) break;
    } catch {}
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Production server did not start: ${output}`);
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<script[^>]+\/assets\//);
  for (const path of [
    '/maps/pixel-office/base.png',
    '/maps/pixel-office/workstation.png',
    '/characters/zep/skin/1.png',
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /image\/png/, path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
  }
  const config = await (await fetch(`${origin}/api/config`)).json();
  assert.equal(config.demo, false);
  console.log('PASS: production page, map, furniture and avatar assets; demo sign-in disabled.');
} finally {
  if (server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
  await rm(temporary, { recursive: true, force: true });
}
