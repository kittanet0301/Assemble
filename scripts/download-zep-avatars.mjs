import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(join(root, 'research/zep-avatar/catalog.json'), 'utf8'));
const folder = join(root, 'public/characters/zep');
await mkdir(folder, { recursive: true });
const jobs = Object.entries(catalog.shapes).flatMap(([slot, shapes]) =>
  [
    ...new Map(shapes.flatMap((shape) => shape.parts).map((part) => [part.partId, part])).values(),
  ].map((part) => ({
    slot,
    ...part,
    url: `https://zep.us/assets/sprites/${slot}/-${part.partId}.png?4`,
  })),
);
const results = [];
let cursor = 0;
function inspect(bytes) {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error('Invalid PNG');
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (width !== 432 || height !== 256) throw new Error(`Unexpected dimensions ${width}x${height}`);
  return {
    width,
    height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++],
      target = join(folder, job.slot, `${job.partId}.png`);
    await mkdir(join(folder, job.slot), { recursive: true });
    try {
      let bytes;
      try {
        bytes = await readFile(target);
        inspect(bytes);
      } catch {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(job.url, { signal: AbortSignal.timeout(25000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
            inspect(bytes);
            await writeFile(`${target}.part`, bytes);
            await rename(`${target}.part`, target);
            break;
          } catch (error) {
            if (attempt === 2) throw error;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }
      results.push({ ...job, ...inspect(bytes), status: 'ok' });
    } catch (error) {
      results.push({ ...job, status: 'failed', error: error.message });
    }
    if (results.length % 100 === 0) console.log(`${results.length}/${jobs.length} files checked`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => a.slot.localeCompare(b.slot) || a.partId - b.partId);
const available = new Set(
  results.filter((r) => r.status === 'ok').map((r) => `${r.slot}/${r.partId}`),
);
const shapes = Object.fromEntries(
  Object.entries(catalog.shapes).map(([slot, items]) => [
    slot,
    items
      .map((shape) => ({
        id: shape.id,
        name: shape.name,
        acquisitionMode: shape.acquisitionMode,
        parts: shape.parts
          .filter((p) => available.has(`${slot}/${p.partId}`))
          .map((p) => ({ id: p.partId, color: p.hex })),
      }))
      .filter((shape) => shape.parts.length)
      .sort((a, b) => a.id - b.id),
  ]),
);
await writeFile(join(root, 'shared/zep-catalog.json'), JSON.stringify(shapes));
await writeFile(
  join(root, 'research/zep-avatar/download-results.json'),
  JSON.stringify(
    {
      catalogUrl: 'https://zep.us/api/avatar/catalog?service=core',
      downloadedAt: new Date().toISOString(),
      expected: jobs.length,
      downloaded: available.size,
      files: results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    expected: jobs.length,
    downloaded: available.size,
    failed: results.filter((r) => r.status !== 'ok').length,
    bytes: results.reduce((sum, r) => sum + (r.bytes || 0), 0),
  }),
);
if (available.size !== jobs.length) process.exitCode = 1;
