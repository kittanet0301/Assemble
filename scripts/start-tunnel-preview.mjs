import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { previewConfig } from '../server/preview.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');
const env = {
  ...process.env,
  PREVIEW_ORIGIN: process.argv[2] ?? process.env.PREVIEW_ORIGIN,
  PREVIEW_PASSWORD: process.env.PREVIEW_PASSWORD || randomBytes(18).toString('base64url'),
};
try {
  previewConfig(env);
  if (!existsSync('dist/index.html')) throw new Error('กรุณารัน pnpm build ก่อน');
} catch (error) {
  console.error(error.message);
  console.error('วิธีใช้: pnpm preview:tunnel https://your-domain.ngrok-free.dev');
  process.exit(1);
}
console.log(`\nTeam preview: ${env.PREVIEW_ORIGIN}`);
console.log(`Preview password (share only with testers): ${env.PREVIEW_PASSWORD}\n`);
const child = spawn(process.execPath, ['server/index.mjs', '--preview'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
