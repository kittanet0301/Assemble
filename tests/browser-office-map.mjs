import { launchBrowser, startDemoServer } from './browser-support.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { OFFICE_SCENE } from '../shared/office-scene.js';
import { WORLD, seatPosition } from '../shared/world.js';

const demo = await startDemoServer();
const { origin } = demo;
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = [],
    failedImages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/maps/') && response.status() >= 400)
      failedImages.push(response.url());
  });
  await page.goto(origin);
  await page.getByLabel('ชื่อที่ให้ทีมเห็น').fill('Pixel office QA');
  await page.getByRole('button', { name: 'เข้าออฟฟิศทดลอง', exact: true }).click();
  await page.locator('.map-person.is-me').waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.office-world img')].every(
      (image) => image.complete && image.naturalWidth,
    ),
  );
  await page.waitForTimeout(400); // Let the existing fit-to-viewport transition finish.
  assert.equal(await page.locator('[data-scene-object]').count(), OFFICE_SCENE.props.length);
  const point = async (x, y) => {
    const b = await page.locator('.office-world').boundingBox();
    return { x: b.x + (x / WORLD.width) * b.width, y: b.y + (y / WORLD.height) * b.height };
  };
  const walkTo = async (target) => {
    const location = await point(target.x, target.y);
    await page.mouse.click(location.x, location.y);
    try {
      await page.waitForFunction(
        (target) => {
          const node = document.querySelector('.map-person.is-me');
          return (
            Number(node.dataset.gridX) === target.x &&
            Number(node.dataset.gridY) === target.y &&
            !node.classList.contains('is-stepping')
          );
        },
        target,
        { timeout: 10000 },
      );
    } catch (error) {
      await page.screenshot({ path: 'docs/preview/pixel-office-debug.png' });
      console.log({
        target,
        actor: await page
          .locator('.map-person.is-me')
          .evaluate((node) => ({
            x: node.dataset.gridX,
            y: node.dataset.gridY,
            style: node.style.cssText,
          }))
          .catch(() => 'no actor'),
      });
      throw error;
    }
  };
  await walkTo({ x: WORLD.spawn.x + 96, y: WORLD.spawn.y });
  // Real server movement behind and in front of the hall plant verifies the
  // same depth ordering used by furniture and actors, without moving DOM nodes.
  await walkTo({ x: 708, y: 468 });
  const depthBehind = await page.evaluate(() => ({
    actor: Number(document.querySelector('.map-person.is-me').style.zIndex),
    plant: Number(document.querySelector('[data-scene-object="plant-8"]').style.zIndex),
  }));
  assert.ok(depthBehind.actor < depthBehind.plant);
  await walkTo({ x: 708, y: 540 });
  const depthFront = await page.evaluate(() => ({
    actor: Number(document.querySelector('.map-person.is-me').style.zIndex),
    plant: Number(document.querySelector('[data-scene-object="plant-8"]').style.zIndex),
  }));
  assert.ok(depthFront.actor > depthFront.plant);
  await page.getByRole('button', { name: 'ที่นั่ง 01 ว่าง', exact: true }).click();
  await page.getByRole('dialog', { name: 'ที่นั่ง 01', exact: true }).waitFor();
  await page.getByRole('button', { name: 'เลือกเป็นที่นั่งของฉัน', exact: true }).click();
  await page.getByRole('button', { name: 'ไปที่นั่งของฉัน', exact: true }).click();
  const seat = seatPosition('01');
  await page.waitForFunction((seat) => {
    const node = document.querySelector('.map-person.is-me');
    return Number(node.dataset.gridX) === seat.x && Number(node.dataset.gridY) === seat.y;
  }, seat);
  await page.waitForTimeout(250); // Wait for the interpolated actor to finish too.
  await page.screenshot({ path: 'docs/preview/pixel-office-desktop.png' });
  await page
    .getByRole('button', { name: /Bloom room/ })
    .filter({ has: page.locator('.room-counter') })
    .click();
  await page.locator('.room-panel').waitFor();
  await page.getByRole('button', { name: 'ปิดรายละเอียดห้อง', exact: true }).click();
  await page.getByRole('button', { name: 'แสดงกริดช่องเดิน', exact: true }).click();
  await page.locator('.pixel-map-grid').waitFor();
  await page.screenshot({ path: 'docs/preview/pixel-office-grid.png' });
  await page.getByRole('button', { name: 'แสดงกริดช่องเดิน', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/preview/pixel-office-mobile.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedImages, []);
  const result = {
    objects: OFFICE_SCENE.props.length,
    depthBehind,
    depthFront,
    seat,
    errors,
    failedImages,
  };
  await writeFile(
    'assets/map/pixel-office/browser-verification.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await demo.close();
}
