import { launchBrowser, startDemoServer } from './browser-support.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { probeWalking } from './browser-character-regression.mjs';

const demo = await startDemoServer();
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  const errors = [],
    missing = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/characters/zep/') && response.status() >= 400)
      missing.push(response.url());
  });
  await page.goto(demo.origin);
  await page.getByLabel('ชื่อที่ให้ทีมเห็น').fill(`ZEP QA ${Date.now()}`);
  await page.getByRole('button', { name: 'เข้าออฟฟิศทดลอง', exact: true }).click();
  await page.getByRole('button', { name: 'โปรไฟล์ของฉัน', exact: true }).click();
  const sprite = page.locator('.character-stage .pixel-walker');
  await page.waitForFunction(() =>
    document
      .querySelector('.character-stage .pixel-walker')
      ?.style.backgroundImage.startsWith('url("data:image/png'),
  );
  const directions = {};
  for (const [label, row] of [
    ['หน้า', 0],
    ['ซ้าย', 1],
    ['ขวา', 2],
    ['หลัง', 3],
  ]) {
    await page.getByRole('button', { name: `มองด้าน${label}`, exact: true }).click();
    directions[label] = await page.evaluate(probeWalking, '.character-stage .pixel-walker');
    assert.ok(
      directions[label].frames.every((frame) => frame.endsWith(`${row ? -row * 64 : 0}px`)),
    );
  }
  await page.getByRole('button', { name: 'หยุดเดิน', exact: true }).click();
  assert.equal(
    await sprite.evaluate((node) => getComputedStyle(node).backgroundPosition),
    '0px -192px',
  );
  await page.getByRole('button', { name: 'มองด้านหน้า', exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'ตัวเลือกหน้าถัดไป', exact: true }).click();
  await page.getByRole('button', { name: 'ทรงผม 117', exact: true }).click();
  const hairColor = page.getByRole('button', { name: /^สีทรงผม / }).last();
  if (await hairColor.count()) await hairColor.click();
  await page.locator('.zep-category-tabs button').filter({ hasText: 'เสื้อผ้า' }).click();
  await page.getByRole('button', { name: 'เสื้อผ้า 2', exact: true }).click();
  await page
    .getByRole('button', { name: /^สีเสื้อผ้า / })
    .last()
    .click();
  await page.locator('.zep-category-tabs button').filter({ hasText: 'แว่นตา' }).click();
  await page.getByRole('button', { name: 'แว่นตา 13', exact: true }).click();
  await page.getByRole('button', { name: 'บันทึกตัวละคร', exact: true }).click();
  await page.getByText('บันทึกตัวละครแล้ว ทุกคนจะเห็นหน้าตาใหม่นี้', { exact: true }).waitFor();
  const appearance = await page.evaluate(
    async () => (await (await fetch('/api/me')).json()).user.appearance,
  );
  assert.equal(appearance.source, 'zep');
  assert.ok(appearance.glasses > 0);
  await page.reload();
  await page.getByRole('button', { name: 'โปรไฟล์ของฉัน', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('.character-stage .pixel-walker')
      ?.style.backgroundImage.startsWith('url("data:image/png'),
  );
  assert.equal(
    await page.getByRole('button', { name: 'บันทึกตัวละคร', exact: true }).isDisabled(),
    true,
  );
  const restored = await page.evaluate(
    async () => (await (await fetch('/api/me')).json()).user.appearance,
  );
  assert.deepEqual(restored, appearance);
  await page.getByRole('button', { name: 'มองด้านหน้า', exact: true }).click();
  await page.locator('.zep-category-tabs button').filter({ hasText: 'เสื้อผ้า' }).click();
  await page.screenshot({ path: 'docs/preview/zep-integrated.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/preview/zep-integrated-mobile.png' });
  assert.ok(await page.locator('.zep-shape').count());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await page.locator('.map-person.is-me .zep-sheet').waitFor();
  await page.keyboard.down('ArrowRight');
  const mapMotion = await page.evaluate(probeWalking, '.map-person.is-me .pixel-walker');
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: 'docs/preview/zep-map.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  const report = { appearance, directions, mapMotion, errors, missing };
  await writeFile(
    'research/zep-avatar/integration-verification.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await demo.close();
}
