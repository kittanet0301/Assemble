import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function launchBrowser() {
  const modulePath = process.argv[2] || process.env.PLAYWRIGHT_MODULE;
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
  const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath =
    process.env.CHROME_EXECUTABLE ||
    (process.platform === 'win32' && existsSync(systemChrome) ? systemChrome : undefined);
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

export async function startDemoServer() {
  const temporary = await mkdtemp(join(tmpdir(), 'assemble-browser-'));
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const origin = `http://localhost:${port}`;
  const server = spawn(process.execPath, ['server/index.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PUBLIC_ORIGIN: origin,
      AUTH_MODE: 'demo',
      DATA_FILE: join(temporary, 'office.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '',
    launchError;
  server.stdout.on('data', (data) => {
    output += data;
  });
  server.stderr.on('data', (data) => {
    output += data;
  });
  server.on('error', (error) => {
    launchError = error;
  });
  const close = async () => {
    if (server.exitCode === null && server.signalCode === null && server.pid) {
      const stopped = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    await rm(temporary, { recursive: true, force: true });
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError;
      if (server.exitCode !== null) throw new Error(`Demo server exited: ${output}`);
      try {
        if ((await fetch(`${origin}/api/health`)).ok) return { origin, close };
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Demo server did not start: ${output}`);
  } catch (error) {
    await close();
    throw error;
  }
}
