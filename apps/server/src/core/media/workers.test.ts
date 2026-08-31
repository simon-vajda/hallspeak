import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaNetworkConfig } from './config';
import {
  REPLACEMENT_LIMIT,
  REPLACEMENT_WINDOW_MS,
  type WorkerFactory,
  WorkerPool,
} from './workers';

const net: MediaNetworkConfig = {
  listenIp: '0.0.0.0',
  announcedIp: '203.0.113.10',
  rtcPortBase: 44400,
  maxWorkers: 4,
};

class FakeRouter extends EventEmitter {
  closed = false;
  readonly observer = new EventEmitter();
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.observer.emit('close');
  }
}

class FakeWorker extends EventEmitter {
  closed = false;
  readonly listenPorts: number[] = [];
  readonly routers: FakeRouter[] = [];
  /** Set to make the next createRouter hang, so a death can race it. */
  hangOnCreateRouter = false;

  readonly servers: Array<{ announced: string[]; closed: boolean }> = [];
  /** Set to make the next createWebRtcServer reject, as a port that will not rebind does. */
  failNextWebRtcServer = false;

  // biome-ignore lint/suspicious/noExplicitAny: a stand-in for mediasoup's Worker.
  async createWebRtcServer(options: any) {
    if (this.failNextWebRtcServer) {
      this.failNextWebRtcServer = false;
      throw new Error('port in use');
    }
    const server = { announced: [] as string[], closed: false, close: () => {} };
    server.close = () => {
      server.closed = true;
    };
    for (const info of options.listenInfos) {
      this.listenPorts.push(info.port);
      server.announced.push(info.announcedAddress);
    }
    this.servers.push(server);
    return server;
  }

  async createRouter() {
    if (this.hangOnCreateRouter) {
      return new Promise<FakeRouter>(() => {});
    }
    const router = new FakeRouter();
    this.routers.push(router);
    return router;
  }

  close() {
    this.closed = true;
  }

  die() {
    this.emit('died', new Error('worker died'));
  }
}

function harness(overrides: Partial<MediaNetworkConfig> = {}, hostCpuCount = 8) {
  const spawned: FakeWorker[] = [];
  let clock = 1_000_000;
  const pool = new WorkerPool({
    net: { ...net, ...overrides },
    hostCpuCount,
    turnConfigured: false,
    createWorker: (async () => {
      const worker = new FakeWorker();
      spawned.push(worker);
      // biome-ignore lint/suspicious/noExplicitAny: the fake stands in for mediasoup's Worker.
      return worker as any;
    }) as WorkerFactory,
    now: () => clock,
  });
  return {
    pool,
    spawned,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

/** Kills index 0 one death past the replacement cap, leaving the pool empty. */
async function killPastTheCap(pool: WorkerPool) {
  for (let i = 0; i < REPLACEMENT_LIMIT; i += 1) {
    const worker = pool.workerAt(0);
    expect(worker).toBeDefined();
    // biome-ignore lint/suspicious/noExplicitAny: the fake exposes die().
    (worker as any).die();
    await vi.waitFor(() => {
      const next = pool.workerAt(0);
      expect(next).toBeDefined();
      expect(next).not.toBe(worker);
    });
  }
  // biome-ignore lint/suspicious/noExplicitAny: the fake exposes die().
  (pool.workerAt(0) as any).die();
  await vi.waitFor(() => expect(pool.size).toBe(0));
}

let errors: string[] = [];
let logs: string[] = [];

beforeEach(() => {
  errors = [];
  logs = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('WorkerPool.start', () => {
  it('holds the smaller of the host core count and the configured maximum', async () => {
    const { pool, spawned } = harness({ maxWorkers: 4 }, 8);
    await pool.start();
    expect(spawned).toHaveLength(4);
    expect(pool.size).toBe(4);
    await pool.close();
  });

  it('is floored by the host core count', async () => {
    const { pool, spawned } = harness({ maxWorkers: 4 }, 2);
    await pool.start();
    expect(spawned).toHaveLength(2);
    await pool.close();
  });

  it('gives worker i the one port base + i, on UDP and TCP alike', async () => {
    const { pool, spawned } = harness({ maxWorkers: 3 }, 3);
    await pool.start();
    expect(spawned[0]?.listenPorts).toEqual([44400, 44400]);
    expect(spawned[1]?.listenPorts).toEqual([44401, 44401]);
    expect(spawned[2]?.listenPorts).toEqual([44402, 44402]);
    await pool.close();
  });

  it('summarises both counts, the ports, the address and TURN', async () => {
    const { pool } = harness({ maxWorkers: 2 }, 8);
    await pool.start();
    const summary = pool.startupSummary();
    expect(summary).toContain('2');
    expect(summary).toContain('8');
    expect(summary).toContain('44400');
    expect(summary).toContain('44401');
    expect(summary).toContain('203.0.113.10');
    expect(summary.toLowerCase()).toContain('turn');
    await pool.close();
  });

  it('names the resolved literal beside a configured hostname, and only then', async () => {
    const { pool } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    expect(pool.startupSummary('198.51.100.4')).toContain('203.0.113.10 (198.51.100.4)');
    expect(pool.startupSummary('203.0.113.10')).toContain('connect to 203.0.113.10 ·');
    await pool.close();
  });
});

describe('WorkerPool.createRouter', () => {
  it('lands two routers on two different workers', async () => {
    const { pool, spawned } = harness({ maxWorkers: 2 }, 2);
    await pool.start();

    const a = await pool.createRouter();
    const b = await pool.createRouter();

    expect(a.workerIndex).not.toBe(b.workerIndex);
    expect(spawned[0]?.routers).toHaveLength(1);
    expect(spawned[1]?.routers).toHaveLength(1);
    await pool.close();
  });

  it('picks the worker with the fewest routers', async () => {
    const { pool } = harness({ maxWorkers: 2 }, 2);
    await pool.start();

    const first = await pool.createRouter();
    const second = await pool.createRouter();
    // Closing the first frees its worker, which must then be the least loaded again.
    first.router.close();
    const third = await pool.createRouter();

    expect(third.workerIndex).toBe(first.workerIndex);
    expect(third.workerIndex).not.toBe(second.workerIndex);
    await pool.close();
  });

  it('refuses with a distinct code when no worker is up', async () => {
    const { pool } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    await killPastTheCap(pool);

    await expect(pool.createRouter()).rejects.toMatchObject({ code: 'media_unavailable' });
    await pool.close();
  });

  it('rejects a creation whose worker dies mid-flight rather than leaving it pending', async () => {
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    const worker = spawned[0];
    if (!worker) {
      throw new Error('no worker');
    }
    worker.hangOnCreateRouter = true;

    const creation = pool.createRouter();
    worker.die();

    await expect(creation).rejects.toThrow(/died/i);
    await pool.close();
  });
});

describe('WorkerPool worker death', () => {
  it('notifies with the index that died, and only that one', async () => {
    const { pool, spawned } = harness({ maxWorkers: 2 }, 2);
    await pool.start();
    const died: number[] = [];
    pool.onWorkerLost((index) => died.push(index));

    spawned[1]?.die();
    await vi.waitFor(() => expect(died).toEqual([1]));
    await pool.close();
  });

  it('starts a replacement at the same index and the same port', async () => {
    const { pool, spawned } = harness({ maxWorkers: 2 }, 2);
    await pool.start();

    spawned[1]?.die();
    await vi.waitFor(() => expect(pool.size).toBe(2));

    expect(spawned).toHaveLength(3);
    expect(spawned[2]?.listenPorts).toEqual([44401, 44401]);
    expect(pool.workerAt(1)).toBe(spawned[2]);
    await pool.close();
  });

  it('leaves other workers untouched', async () => {
    const { pool, spawned } = harness({ maxWorkers: 2 }, 2);
    await pool.start();
    const survivor = spawned[0];

    spawned[1]?.die();
    await vi.waitFor(() => expect(spawned).toHaveLength(3));

    expect(survivor?.closed).toBe(false);
    await pool.close();
  });

  it('stops replacing an index that dies repeatedly inside the window, and says so', async () => {
    const { pool } = harness({ maxWorkers: 1 }, 1);
    await pool.start();

    await killPastTheCap(pool);

    expect(pool.size).toBe(0);
    expect(errors.join('\n')).toMatch(/0/);
    expect(errors.join('\n').toLowerCase()).toMatch(/left down|giving up|not replac/);
    await pool.close();
  });

  it('makes the index eligible again once the window has elapsed', async () => {
    vi.useFakeTimers();
    const { pool, advance } = harness({ maxWorkers: 1 }, 1);
    await pool.start();

    for (let i = 0; i <= REPLACEMENT_LIMIT; i += 1) {
      const worker = pool.workerAt(0);
      // biome-ignore lint/suspicious/noExplicitAny: the fake exposes die().
      (worker as any)?.die();
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(pool.size).toBe(0);

    advance(REPLACEMENT_WINDOW_MS + 1);
    await vi.advanceTimersByTimeAsync(REPLACEMENT_WINDOW_MS + 1);

    expect(pool.size).toBe(1);
    await pool.close();
  });
});

/**
 * The only check that the prebuilt worker binary this host downloaded actually runs and
 * binds. Everything above it stands in a fake for the subprocess, so a broken install
 * would otherwise be a green suite and a boot failure.
 */
describe('WorkerPool against real mediasoup workers', () => {
  it('starts, creates a router on a real worker, and closes without leaving one behind', async () => {
    // Ephemeral range, randomized: nothing else in the suite binds a port.
    const rtcPortBase = 49_500 + Math.floor(Math.random() * 500) * 4;
    const pool = new WorkerPool({
      net: { listenIp: '127.0.0.1', announcedIp: '127.0.0.1', rtcPortBase, maxWorkers: 1 },
      turnConfigured: false,
      hostCpuCount: 1,
    });

    await pool.start();
    expect(pool.size).toBe(1);

    const { router, webRtcServer, workerIndex } = await pool.createRouter();
    expect(workerIndex).toBe(0);
    expect(webRtcServer.closed).toBe(false);
    expect(router.rtpCapabilities.codecs?.some((c) => c.mimeType === 'audio/opus')).toBe(true);

    const worker = pool.workerAt(0);
    await pool.close();
    expect(worker?.closed).toBe(true);
    expect(pool.size).toBe(0);
  }, 15_000);
});

describe('WorkerPool.close', () => {
  it('closes every worker and holds none afterwards', async () => {
    const { pool, spawned } = harness({ maxWorkers: 3 }, 3);
    await pool.start();

    await pool.close();

    expect(spawned.every((w) => w.closed)).toBe(true);
    expect(pool.size).toBe(0);
  });

  it('does not replace a worker whose death arrives during shutdown', async () => {
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();

    await pool.close();
    spawned[0]?.die();
    await vi.waitFor(() => expect(spawned).toHaveLength(1));
    expect(pool.size).toBe(0);
  });
});

describe('WorkerPool.setAnnouncedAddress', () => {
  it('rebuilds every server on the new address and drops the rooms that were on it', async () => {
    const { pool, spawned } = harness({ maxWorkers: 2 }, 2);
    const lost: Array<[number, string]> = [];
    pool.onWorkerLost((index, reason) => lost.push([index, reason]));
    await pool.start();

    await pool.setAnnouncedAddress('198.51.100.7');

    expect(lost).toEqual([
      [0, 'address_changed'],
      [1, 'address_changed'],
    ]);
    for (const worker of spawned) {
      expect(worker.servers[0]?.closed).toBe(true);
      expect(worker.servers[1]?.announced).toEqual(['198.51.100.7', '198.51.100.7']);
    }
    await pool.close();
  });

  it('fails a creation in flight rather than pairing it with the closed server', async () => {
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    const worker = spawned[0];
    if (!worker) {
      throw new Error('no worker');
    }
    worker.hangOnCreateRouter = true;
    const pending = pool.createRouter();
    const settled = expect(pending).rejects.toThrow(/re-announcing/);

    await pool.setAnnouncedAddress('198.51.100.7');

    await settled;
    await pool.close();
  });

  it('replaces a worker whose port will not rebind, rather than leaving a closed server', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    const original = spawned[0];
    if (!original) {
      throw new Error('no worker');
    }
    original.failNextWebRtcServer = true;

    await pool.setAnnouncedAddress('198.51.100.7');

    expect(original.closed).toBe(true);
    expect(spawned).toHaveLength(2);
    expect(spawned[1]?.servers[0]?.announced).toEqual(['198.51.100.7', '198.51.100.7']);
    expect(pool.size).toBe(1);
    await pool.close();
  });

  it('does not spawn a replacement for a rebind that failed after close()', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();
    const original = spawned[0];
    if (!original) {
      throw new Error('no worker');
    }
    original.failNextWebRtcServer = true;

    const moving = pool.setAnnouncedAddress('198.51.100.7');
    await pool.close();
    await moving;

    expect(spawned).toHaveLength(1);
    expect(pool.size).toBe(0);
  });

  it('applies two moves in order rather than interleaving their rebuilds', async () => {
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    await pool.start();

    await Promise.all([
      pool.setAnnouncedAddress('198.51.100.7'),
      pool.setAnnouncedAddress('192.0.2.5'),
    ]);

    const worker = spawned[0];
    expect(worker?.servers.map((server) => server.announced[0])).toEqual([
      '203.0.113.10',
      '198.51.100.7',
      '192.0.2.5',
    ]);
    await pool.close();
  });

  it('does nothing when the address has not moved, so a poll costs no rooms', async () => {
    const { pool, spawned } = harness({ maxWorkers: 1 }, 1);
    const lost: number[] = [];
    pool.onWorkerLost((index) => lost.push(index));
    await pool.start();

    await pool.setAnnouncedAddress('203.0.113.10');

    expect(lost).toEqual([]);
    expect(spawned[0]?.servers).toHaveLength(1);
    await pool.close();
  });
});
