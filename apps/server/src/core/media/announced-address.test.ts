import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogDestination } from '../../lib/log';
import { AnnouncedAddress } from './announced-address';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'trace', LOG_DIR: '' },
}));
vi.mock('../../env', () => ({ env: envMock }));

const INFO = 30;
const WARN = 40;

let records: Record<string, unknown>[] = [];

beforeEach(() => {
  records = [];
  useLogDestination({
    write(chunk: string) {
      records.push(JSON.parse(chunk));
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const at = (level: number) => records.filter((record) => record.level === level);

function tracker(resolve: (hostname: string) => Promise<string[]>) {
  return new AnnouncedAddress({ configured: 'home.example.org', resolve, pollMs: 1000 });
}

describe('AnnouncedAddress.start', () => {
  it('leaves a literal address alone and never polls for one', async () => {
    const resolve = vi.fn();
    const announced = new AnnouncedAddress({ configured: '203.0.113.10', resolve });

    expect(await announced.start()).toBe('203.0.113.10');
    expect(resolve).not.toHaveBeenCalled();
    expect(announced.isTracking).toBe(false);
  });

  it('resolves a hostname, because a browser is not required to resolve one itself', async () => {
    const announced = tracker(async () => ['203.0.113.10']);

    expect(await announced.start()).toBe('203.0.113.10');
    expect(announced.current).toBe('203.0.113.10');
    announced.close();
  });

  it('fails the boot rather than starting with nothing to announce', async () => {
    const announced = tracker(async () => {
      throw new Error('ENOTFOUND');
    });

    await expect(announced.start()).rejects.toThrow(/PUBLIC_ADDRESS/);
  });

  it('refuses to boot on a name that answers only with private addresses', async () => {
    const announced = tracker(async () => ['192.168.1.20', '10.0.0.4']);

    await expect(announced.start()).rejects.toThrow(/private or loopback/);
  });

  it('skips a private answer and announces the routable one beside it', async () => {
    const announced = tracker(async () => ['192.168.1.20', '203.0.113.10']);

    expect(await announced.start()).toBe('203.0.113.10');
    announced.close();
  });
});

describe('AnnouncedAddress polling', () => {
  it('reports a moved address to its listeners', async () => {
    vi.useFakeTimers();
    let current = ['203.0.113.10'];
    const announced = tracker(async () => current);
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    current = ['198.51.100.7'];
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen).toEqual(['198.51.100.7']);
    expect(announced.current).toBe('198.51.100.7');
    expect(at(INFO)).toEqual([
      expect.objectContaining({
        msg: 'public address moved; re-announcing',
        configured: 'home.example.org',
        previous: '203.0.113.10',
        announced: '198.51.100.7',
        subsystem: 'media',
      }),
    ]);
    announced.close();
  });

  it('says nothing while the address is unchanged', async () => {
    vi.useFakeTimers();
    const announced = tracker(async () => ['203.0.113.10']);
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(seen).toEqual([]);
    announced.close();
  });

  it('keeps the last known address through a failed lookup, which is not a move', async () => {
    vi.useFakeTimers();
    let fail = false;
    const announced = tracker(async () => {
      if (fail) {
        throw new Error('SERVFAIL');
      }
      return ['203.0.113.10'];
    });
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    fail = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen).toEqual([]);
    expect(announced.current).toBe('203.0.113.10');
    expect(at(WARN)).toEqual([
      expect.objectContaining({
        msg: 'could not re-resolve the public address; still announcing the last known one',
        configured: 'home.example.org',
        announced: '203.0.113.10',
        err: expect.objectContaining({ message: 'SERVFAIL' }),
      }),
    ]);
    announced.close();
  });

  it('holds the address a rotating record still answers with', async () => {
    vi.useFakeTimers();
    const announced = tracker(async () => ['198.51.100.7', '203.0.113.10'].reverse());
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(seen).toEqual([]);
    announced.close();
  });

  it('keeps the last known address when the name goes private, which is not a move', async () => {
    vi.useFakeTimers();
    let answers = ['203.0.113.10'];
    const announced = tracker(async () => answers);
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    answers = ['192.168.1.20'];
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen).toEqual([]);
    expect(announced.current).toBe('203.0.113.10');
    expect(at(WARN)).toEqual([
      expect.objectContaining({
        msg: 'the public address resolves to nothing routable; still announcing the last known one',
        configured: 'home.example.org',
        answers: ['192.168.1.20'],
        announced: '203.0.113.10',
      }),
    ]);
    announced.close();
  });

  it('does not stack a lookup slower than the poll interval', async () => {
    vi.useFakeTimers();
    let release!: (addresses: string[]) => void;
    const resolve = vi
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValueOnce(['203.0.113.10'])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((settle) => {
            release = settle;
          }),
      );
    const announced = tracker(resolve);

    await announced.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(resolve).toHaveBeenCalledTimes(2);
    release(['203.0.113.10']);
    announced.close();
  });

  it('stops polling once closed', async () => {
    vi.useFakeTimers();
    const resolve = vi.fn(async () => ['203.0.113.10']);
    const announced = tracker(resolve);

    await announced.start();
    announced.close();
    await vi.advanceTimersByTimeAsync(5000);

    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
