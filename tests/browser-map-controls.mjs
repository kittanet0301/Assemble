import { launchBrowser, startDemoServer } from './browser-support.mjs';
import assert from 'node:assert/strict';

const demo = await startDemoServer();
const { origin } = demo;
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const moves = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      try {
        const message = JSON.parse(String(payload));
        if (message.type === 'move') moves.push(message);
      } catch {}
    }),
  );
  await page.goto(origin);
  await page.getByLabel('ชื่อที่ให้ทีมเห็น').fill('Map controls QA');
  await page.getByRole('button', { name: 'เข้าออฟฟิศทดลอง', exact: true }).click();
  await page.locator('.map-person.is-me').waitFor();
  assert.equal(await page.locator('.you-arrow').count(), 0);
  for (const selector of ['.map-person.is-me', '.map-person.is-me .pixel-walker']) {
    assert.equal(
      await page
        .locator(selector)
        .evaluate((element) => getComputedStyle(element, '::after').content),
      'none',
    );
  }
  const stage = page.locator('.map-stage');
  await stage.hover();
  const zoom = () => page.locator('.zoom-controls > span').innerText();
  assert.equal(await zoom(), '100%');
  await page.mouse.wheel(0, -300);
  await page.waitForFunction(
    () => parseInt(document.querySelector('.zoom-controls > span').textContent) > 100,
  );
  await page.mouse.wheel(0, 10000);
  await page.waitForFunction(
    () => document.querySelector('.zoom-controls > span').textContent === '75%',
  );
  await page.mouse.wheel(0, -10000);
  await page.waitForFunction(
    () => document.querySelector('.zoom-controls > span').textContent === '225%',
  );
  const dispatchKey = (type, key, code, selector = 'body') =>
    page.evaluate(
      ({ type, key, code, selector }) => {
        document
          .querySelector(selector)
          .dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
      },
      { type, key, code, selector },
    );
  for (const [key, code, dx, dy] of [
    ['ไ', 'KeyW', 0, -1],
    ['ฟ', 'KeyA', -1, 0],
    ['ห', 'KeyS', 0, 1],
    ['ก', 'KeyD', 1, 0],
  ]) {
    const start = moves.length;
    await dispatchKey('keydown', key, code);
    await page.waitForTimeout(40);
    assert.ok(
      moves.slice(start).some((move) => move.dx === dx && move.dy === dy),
      code,
    );
    // Switching layouts while held must still release the same physical key.
    await dispatchKey('keyup', code.at(-1).toLowerCase(), code);
    await page.waitForTimeout(40);
    assert.deepEqual([moves.at(-1).dx, moves.at(-1).dy], [0, 0]);
  }
  await page.waitForTimeout(200);
  const beforeDiagonal = await page.locator('.map-person.is-me').evaluate((element) => ({
    x: Number(element.dataset.gridX),
    y: Number(element.dataset.gridY),
  }));
  await dispatchKey('keydown', 'ไ', 'KeyW');
  await dispatchKey('keydown', 'ฟ', 'KeyA');
  await page.waitForFunction(({ x, y }) => {
    const element = document.querySelector('.map-person.is-me');
    return (
      Number(element.dataset.gridX) < x &&
      Number(element.dataset.gridY) < y &&
      element.style.getPropertyValue('--map-row') === '1'
    );
  }, beforeDiagonal);
  assert.ok(
    moves.some((move) => move.dx === -1 && move.dy === -1),
    'two held keys send a diagonal',
  );
  await dispatchKey('keyup', 'ฟ', 'KeyA');
  await page.waitForTimeout(40);
  assert.deepEqual([moves.at(-1).dx, moves.at(-1).dy], [0, -1], 'releasing left continues upward');
  await dispatchKey('keyup', 'ไ', 'KeyW');
  await page.waitForTimeout(40);
  assert.deepEqual([moves.at(-1).dx, moves.at(-1).dy], [0, 0]);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'typing-check';
    document.body.append(input);
    input.focus();
  });
  const beforeTyping = moves.length;
  await dispatchKey('keydown', 'ไ', 'KeyW', '#typing-check');
  await dispatchKey('keyup', 'ไ', 'KeyW', '#typing-check');
  await page.waitForTimeout(180);
  assert.equal(moves.length, beforeTyping, 'typing must not move the character');
  assert.deepEqual(errors, []);
  console.log(
    'PASS: no avatar rings/arrow; wheel zoom and limits; Thai WASD; diagonal movement facing left; key release; typing isolation.',
  );
} finally {
  await browser?.close();
  await demo.close();
}
