import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const services = [
  { name: 'api', dir: 'apps/api', color: '\x1b[36m', cmd: ['pnpm', '--dir', 'apps/api', 'dev'] },
  { name: 'store', dir: 'apps/store', color: '\x1b[32m', cmd: ['pnpm', '--dir', 'apps/store', 'dev'] },
];

if (existsSync(resolve(repoRoot, 'apps/admin/package.json'))) {
  services.push({ name: 'admin', dir: 'apps/admin', color: '\x1b[35m', cmd: ['pnpm', '--dir', 'apps/admin', 'dev'] });
}

const reset = '\x1b[0m';
const children = [];

function runService(service) {
  const child = spawn(service.cmd[0], service.cmd.slice(1), {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const prefix = `${service.color}[${service.name}]${reset}`;
  child.stdout.on('data', (chunk) => process.stdout.write(`${prefix} ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`${prefix} ${chunk}`));

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stderr.write(`${prefix} exited with ${reason}\n`);
    if (!shuttingDown && code !== 0) {
      shutdown(code ?? 1);
    }
  });

  children.push(child);
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const service of services) runService(service);
