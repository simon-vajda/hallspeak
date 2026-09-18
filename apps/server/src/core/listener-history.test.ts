import { LISTENER_HISTORY_WINDOW_MS } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import { ListenerHistoryRegistry } from './listener-history';

const MINUTE = 60 * 1000;

function harness(startedAt: number | 'none' = 0) {
  const clock = { now: 0 };
  const claims = new Map<number, number | undefined>([
    [10, startedAt === 'none' ? undefined : startedAt],
  ]);
  const registry = new ListenerHistoryRegistry({
    now: () => clock.now,
    claimStartedAt: (channelId) => claims.get(channelId),
  });
  return { clock, claims, registry };
}

describe('ListenerHistoryRegistry', () => {
  it('seeds a new history at the claim start with a count of zero', () => {
    const { clock, registry } = harness(0);

    clock.now = 5000;
    registry.record(1, 10, 3);

    expect(registry.snapshot(1, 10, 3)).toEqual([
      { count: 0, ageMs: 5000 },
      { count: 3, ageMs: 0 },
    ]);
  });

  it('appends nothing when the count has not changed', () => {
    const { clock, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 2);
    clock.now = 2000;
    registry.record(1, 10, 2);

    expect(registry.snapshot(1, 10, 2)).toEqual([
      { count: 0, ageMs: 2000 },
      { count: 2, ageMs: 1000 },
    ]);
  });

  it('keeps every point when the claim keeps its start across a rebind or a handover move', () => {
    const { clock, claims, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 1);
    clock.now = 2000;
    claims.set(10, 0);
    registry.record(1, 10, 4);

    expect(registry.snapshot(1, 10, 4)).toEqual([
      { count: 0, ageMs: 2000 },
      { count: 1, ageMs: 1000 },
      { count: 4, ageMs: 0 },
    ]);
  });

  it('records into the existing history while no claim is held, and the returning claim sees it', () => {
    const { clock, claims, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 1);

    claims.set(10, undefined);
    clock.now = 2000;
    registry.record(1, 10, 2);

    claims.set(10, 0);
    clock.now = 3000;

    expect(registry.snapshot(1, 10, 2)).toEqual([
      { count: 0, ageMs: 3000 },
      { count: 1, ageMs: 2000 },
      { count: 2, ageMs: 1000 },
    ]);
  });

  it('reseeds when a claim starts a new span', () => {
    const { clock, claims, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 5);

    claims.set(10, 4000);
    clock.now = 5000;
    registry.record(1, 10, 2);

    expect(registry.snapshot(1, 10, 2)).toEqual([
      { count: 0, ageMs: 1000 },
      { count: 2, ageMs: 0 },
    ]);
  });

  it('keeps the newest point from before the window so the line reaches its left edge', () => {
    const { clock, claims, registry } = harness(0);

    claims.set(10, -100 * MINUTE);
    clock.now = -90 * MINUTE;
    registry.record(1, 10, 1);
    clock.now = -70 * MINUTE;
    registry.record(1, 10, 2);
    clock.now = -30 * MINUTE;
    registry.record(1, 10, 3);
    clock.now = 0;

    expect(registry.snapshot(1, 10, 3)).toEqual([
      { count: 2, ageMs: 70 * MINUTE },
      { count: 3, ageMs: 30 * MINUTE },
    ]);
    expect(LISTENER_HISTORY_WINDOW_MS).toBe(60 * MINUTE);
  });

  it('appends the live count only when it differs from the last stored point', () => {
    const { clock, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 2);
    clock.now = 2000;

    expect(registry.snapshot(1, 10, 2)).toEqual([
      { count: 0, ageMs: 2000 },
      { count: 2, ageMs: 1000 },
    ]);
    expect(registry.snapshot(1, 10, 7)).toEqual([
      { count: 0, ageMs: 2000 },
      { count: 2, ageMs: 1000 },
      { count: 7, ageMs: 0 },
    ]);
  });

  it('seeds a snapshot taken before any recount under a fresh claim', () => {
    const { clock, registry } = harness(0);

    clock.now = 3000;

    expect(registry.snapshot(1, 10, 0)).toEqual([{ count: 0, ageMs: 3000 }]);
  });

  it('returns undefined with no claim and no stored history', () => {
    const { registry } = harness('none');

    expect(registry.snapshot(1, 10, 0)).toBeUndefined();
  });

  it('creates nothing when recording with no claim and no stored history', () => {
    const { clock, registry } = harness('none');

    clock.now = 1000;
    registry.record(1, 10, 4);

    expect(registry.snapshot(1, 10, 4)).toBeUndefined();
  });

  it('scopes a history to its own channel and event', () => {
    const { clock, claims, registry } = harness(0);
    claims.set(11, 0);

    clock.now = 1000;
    registry.record(1, 10, 1);

    expect(registry.snapshot(2, 10, 1)).toEqual([
      { count: 0, ageMs: 1000 },
      { count: 1, ageMs: 0 },
    ]);
    expect(registry.snapshot(1, 11, 0)).toEqual([{ count: 0, ageMs: 1000 }]);
  });

  it('forgets one channel only', () => {
    const { clock, claims, registry } = harness(0);
    claims.set(11, 0);

    clock.now = 1000;
    registry.record(1, 10, 1);
    registry.record(1, 11, 2);

    registry.forgetChannel(1, 10);
    claims.set(10, undefined);
    claims.set(11, undefined);

    expect(registry.snapshot(1, 10, 1)).toBeUndefined();
    expect(registry.snapshot(1, 11, 2)).toEqual([
      { count: 0, ageMs: 1000 },
      { count: 2, ageMs: 0 },
    ]);
  });

  it('forgets every channel of one event only', () => {
    const { clock, claims, registry } = harness(0);
    claims.set(11, 0);

    clock.now = 1000;
    registry.record(1, 10, 1);
    registry.record(1, 11, 2);
    registry.record(2, 10, 3);

    registry.forgetEvent(1);
    claims.set(10, undefined);
    claims.set(11, undefined);

    expect(registry.snapshot(1, 10, 1)).toBeUndefined();
    expect(registry.snapshot(1, 11, 2)).toBeUndefined();
    expect(registry.snapshot(2, 10, 3)).toEqual([
      { count: 0, ageMs: 1000 },
      { count: 3, ageMs: 0 },
    ]);
  });

  it('forgets everything on close', () => {
    const { clock, claims, registry } = harness(0);

    clock.now = 1000;
    registry.record(1, 10, 1);
    registry.close();
    claims.set(10, undefined);

    expect(registry.snapshot(1, 10, 1)).toBeUndefined();
  });
});
