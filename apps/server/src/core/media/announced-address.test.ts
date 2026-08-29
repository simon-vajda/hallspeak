import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncedAddress } from './announced-address';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function tracker(resolve: (hostname: string) => Promise<string[]>, announceHostname = false) {
  return new AnnouncedAddress({
    configured: 'home.example.org',
    announceHostname,
    resolve,
    pollMs: 1000,
  });
}

describe('AnnouncedAddress.start', () => {
  it('leaves a literal address alone and never polls for one', async () => {
    const resolve = vi.fn();
    const announced = new AnnouncedAddress({
      configured: '203.0.113.10',
      announceHostname: false,
      resolve,
    });

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

  it('announces the hostname untouched when the operator has opted out', async () => {
    const resolve = vi.fn();
    const announced = tracker(resolve, true);

    expect(await announced.start()).toBe('home.example.org');
    expect(resolve).not.toHaveBeenCalled();
    expect(announced.isTracking).toBe(false);
  });

  it('fails the boot rather than starting with nothing to announce', async () => {
    const announced = tracker(async () => {
      throw new Error('ENOTFOUND');
    });

    await expect(announced.start()).rejects.toThrow(/MEDIA_ANNOUNCE_HOSTNAME/);
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let answers = ['203.0.113.10'];
    const announced = tracker(async () => answers);
    const seen: string[] = [];
    announced.onChange((address) => seen.push(address));

    await announced.start();
    answers = ['192.168.1.20'];
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen).toEqual([]);
    expect(announced.current).toBe('203.0.113.10');
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
