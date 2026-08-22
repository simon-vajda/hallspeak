#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// The dev ports: the server (PORT, default 3000) and Vite's fixed 5173.
const ports = [Number(process.env.PORT) || 3000, 5173];

/** PIDs listening on a TCP port, excluding this process. Empty when nothing holds it. */
function listenersOn(port) {
  try {
    const out = execFileSync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return [...new Set(out.split('\n').map(Number).filter(Boolean))].filter(
      (pid) => pid !== process.pid,
    );
  } catch {
    // lsof exits 1 when nothing matches.
    return [];
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function describe(pid) {
  try {
    return execFileSync('ps', ['-o', 'comm=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

if (process.platform === 'win32') {
  console.warn('free-ports: skipped, lsof is unavailable on Windows.');
  process.exit(0);
}

for (const port of ports) {
  const pids = listenersOn(port);
  if (pids.length === 0) {
    console.log(`free-ports: port ${port} is already free`);
    continue;
  }

  for (const pid of pids) {
    console.log(`free-ports: killing ${describe(pid)} (pid ${pid}) on port ${port}`);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone, or not ours to kill — the recheck below reports it.
    }
  }

  // Give a graceful shutdown a moment before escalating.
  for (let i = 0; i < 20 && pids.some(alive); i++) {
    await delay(50);
  }

  for (const pid of pids.filter(alive)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      console.warn(`free-ports: could not kill pid ${pid} on port ${port}`);
    }
  }
}
