import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targets = ['apps/api', 'packages/database'];

for (const target of targets) {
  const envExample = path.join(rootDir, target, '.env.example');
  const envTarget = path.join(rootDir, target, '.env');
  if (fs.existsSync(envExample) && !fs.existsSync(envTarget)) {
    fs.copyFileSync(envExample, envTarget);
    console.log(`[setup-env] Created ${target}/.env from .env.example`);
  }
}
