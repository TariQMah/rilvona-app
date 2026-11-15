import { execSync } from 'child_process';
import path from 'path';
import { applyTestEnv } from './env';

export default function globalSetup() {
  applyTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
}
