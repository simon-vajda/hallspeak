import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomRegistry } from './registry';
import type { Room } from './room';
import type { RouterAllocation, WorkerPool } from './workers';

const GRACE_MS = 1000;

class FakeRouter {
  closed = false;
  readonly observer = new EventEmitter();
  close = vi.fn(() => {
    this.closed = true;
    this.observer.emit('close');
  });
  // biome-ignore lint/suspicious/noExplicitAny: a stand-in for mediasoup's Router.
  async createWebRtcTransport(_options: any): Promise<any> {
    return { id: `t${Math.random()}`, closed: false, close: vi.fn() };
  }
}

class FakeProducer extends EventEmitter {
  closed = false;
  readonly observer = new EventEmitter();
  constructor(readonly id = 'p1') {
    super();
  }
  close = vi.fn(() => {
    this.closed = true;
    this.observer.emit('close');
  });
}

/** A pool whose router creation can be held open, so a race has somewhere to happen. */
function fakePool() {
  const routers: FakeRouter[] = [];
  let nextWorkerIndex = 0;
  let gate: { resolve: () => void; promise: Promise<void> } | undefined;
  let failNext: Error | undefined;
  const deathListeners = new Set<(index: number) => void>();

  const pool = {
    createRouter: async (): Promise<RouterAllocation> => {
      if (gate) await gate.promise;
      if (failNext) {
        const err = failNext;
        failNext = undefined;
        throw err;
      }
      const router = new FakeRouter();
      routers.push(router);
      return {
        // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's.
        router: router as any,
        // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's.
        webRtcServer: { id: 'wrs' } as any,
        workerIndex: nextWorkerIndex,
      };
    },
    onWorkerDied: (listener: (index: number) => void) => {
      deathListeners.add(listener);
      return () => deathListeners.delete(listener);
    },
  } as unknown as WorkerPool;

  return {
    pool,
    routers,
    killWorker: (index: number) => {
      for (const listener of deathListeners) listener(index);
    },
    onWorker: (index: number) => {
      nextWorkerIndex = index;
    },
    failNextCreation: (err: Error) => {
      failNext = err;
    },
    hold: () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      gate = { resolve, promise };
      return () => {
        gate = undefined;
        resolve();
      };
    },
  };
}

function harness() {
  const pool = fakePool();
  const closed: Array<{ eventId: number; reason: string }> = [];
  const registry = new RoomRegistry(pool.pool, {
    graceMs: GRACE_MS,
    onRoomClosed: (room: Room, reason: string) => closed.push({ eventId: room.eventId, reason }),
  });
  return { ...pool, registry, closed };
}

// biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
const as = (value: unknown) => value as any;

let errors: string[] = [];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RoomRegistry.getOrCreate under concurrency', () => {
  // Ordering luck is exactly what this unit exists to defeat, so it runs more than once.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    it(`converges two concurrent calls on one router (attempt ${attempt})`, async () => {
      const { registry, routers, hold } = harness();
      const release = hold();

      const both = Promise.all([registry.getOrCreate(1), registry.getOrCreate(1)]);
      release();
      const [a, b] = await both;

      expect(a).toBe(b);
      expect(routers).toHaveLength(1);
      await registry.closeAll();
    });
  }

  it('converges five concurrent calls the same way', async () => {
    const { registry, routers, hold } = harness();
    const release = hold();

    const all = Promise.all([1, 1, 1, 1, 1].map(() => registry.getOrCreate(1)));
    release();
    const rooms = await all;

    expect(new Set(rooms).size).toBe(1);
    expect(routers).toHaveLength(1);
    await registry.closeAll();
  });

  it('keeps two different events on their own routers', async () => {
    const { registry, routers } = harness();
    const first = await registry.getOrCreate(1);
    const second = await registry.getOrCreate(2);

    expect(first).not.toBe(second);
    expect(routers).toHaveLength(2);
    await registry.closeAll();
  });
});

describe('RoomRegistry.getOrCreate failure', () => {
  it('clears the cached promise so a later call retries rather than returning the rejection', async () => {
    const { registry, failNextCreation } = harness();
    failNextCreation(new Error('no worker'));

    await expect(registry.getOrCreate(1)).rejects.toThrow('no worker');
    await expect(registry.getOrCreate(1)).resolves.toBeDefined();
    await registry.closeAll();
  });

  it('logs the failure with the event id and the cause', async () => {
    const { registry, failNextCreation } = harness();
    failNextCreation(new Error('port exhausted'));

    await expect(registry.getOrCreate(42)).rejects.toThrow();

    expect(errors.join('\n')).toContain('42');
    expect(errors.join('\n')).toContain('port exhausted');
  });

  it('rejects a creation whose worker dies mid-flight rather than leaving it pending', async () => {
    const { registry, hold, failNextCreation, killWorker } = harness();
    const release = hold();

    const creation = registry.getOrCreate(1);
    failNextCreation(new Error('mediasoup worker 0 died'));
    killWorker(0);
    release();

    await expect(creation).rejects.toThrow(/died/);
    // And the entry is clear, so the event is not wedged until restart.
    await expect(registry.getOrCreate(1)).resolves.toBeDefined();
    await registry.closeAll();
  });
});

describe('RoomRegistry idle teardown', () => {
  it('arms teardown when the last producer closes, and closes the room after the grace period', async () => {
    vi.useFakeTimers();
    const { registry, closed } = harness();
    const room = await registry.getOrCreate(1);
    room.setProducer(1, as(new FakeProducer()));

    room.closeProducer(1);
    registry.releaseIfIdle(1);
    expect(registry.get(1)).toBe(room);

    await vi.advanceTimersByTimeAsync(GRACE_MS + 1);

    expect(registry.get(1)).toBeUndefined();
    expect(closed).toEqual([{ eventId: 1, reason: 'idle' }]);
  });

  it('cancels the pending teardown when a channel produces again, and reuses the router', async () => {
    vi.useFakeTimers();
    const { registry, routers } = harness();
    const room = await registry.getOrCreate(1);
    room.setProducer(1, as(new FakeProducer()));
    room.closeProducer(1);
    registry.releaseIfIdle(1);

    await vi.advanceTimersByTimeAsync(GRACE_MS / 2);
    const again = await registry.getOrCreate(1);
    await vi.advanceTimersByTimeAsync(GRACE_MS + 1);

    expect(again).toBe(room);
    expect(routers).toHaveLength(1);
    expect(registry.get(1)).toBe(room);
    await registry.closeAll();
  });

  it('yields a live room, never a closed router, when a produce arrives as the timer fires', async () => {
    vi.useFakeTimers();
    const { registry } = harness();
    const first = await registry.getOrCreate(1);
    registry.releaseIfIdle(1);

    await vi.advanceTimersByTimeAsync(GRACE_MS + 1);
    const second = await registry.getOrCreate(1);

    expect(second).not.toBe(first);
    expect(second.router.closed).toBe(false);
    await registry.closeAll();
  });

  it('does not arm teardown while a transport is still attached', async () => {
    vi.useFakeTimers();
    const { registry } = harness();
    const room = await registry.getOrCreate(1);
    await room.createTransport('socket-1', 'recv');

    registry.releaseIfIdle(1);
    await vi.advanceTimersByTimeAsync(GRACE_MS + 1);

    expect(registry.get(1)).toBe(room);
    await registry.closeAll();
  });

  it('is a no-op for an event with no room', () => {
    const { registry } = harness();
    expect(() => registry.releaseIfIdle(99)).not.toThrow();
  });
});

describe('RoomRegistry.evictWorker', () => {
  it('closes only the rooms on that index', async () => {
    const { registry, onWorker, killWorker, closed } = harness();
    onWorker(0);
    const onZero = await registry.getOrCreate(1);
    onWorker(1);
    const onOne = await registry.getOrCreate(2);

    killWorker(0);

    expect(registry.get(1)).toBeUndefined();
    expect(registry.get(2)).toBe(onOne);
    expect(onZero.router.closed).toBe(true);
    expect(closed).toEqual([{ eventId: 1, reason: 'worker_died' }]);
    await registry.closeAll();
  });

  it('leaves the event free to be created again on a replacement worker', async () => {
    const { registry, onWorker, killWorker } = harness();
    onWorker(0);
    await registry.getOrCreate(1);

    killWorker(0);
    const rebuilt = await registry.getOrCreate(1);

    expect(rebuilt.router.closed).toBe(false);
    await registry.closeAll();
  });
});

describe('RoomRegistry lifetime', () => {
  it('never creates a room except through getOrCreate', async () => {
    const { registry, routers } = harness();
    expect(registry.get(1)).toBeUndefined();
    registry.releaseIfIdle(1);
    expect(routers).toHaveLength(0);
    await registry.closeAll();
  });

  it('closeAll closes every room and cancels every pending teardown', async () => {
    vi.useFakeTimers();
    const { registry } = harness();
    const first = await registry.getOrCreate(1);
    const second = await registry.getOrCreate(2);
    registry.releaseIfIdle(1);

    await registry.closeAll();

    expect(first.router.closed).toBe(true);
    expect(second.router.closed).toBe(true);
    expect(registry.get(1)).toBeUndefined();
    // The armed timer must not fire against rooms that are already gone.
    await vi.advanceTimersByTimeAsync(GRACE_MS + 1);
    expect(registry.all()).toEqual([]);
    expect(first.router.close).toHaveBeenCalledTimes(1);
  });
});
