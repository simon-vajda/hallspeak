import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from './notifications';
import {
  REPORT_COOLDOWN_MS,
  REPORT_RESOLUTION_WINDOW_MS,
  REPORT_WINDOW_MS,
  ReportRegistry,
} from './reports';

function harness() {
  const published: Notification[] = [];
  const registry = new ReportRegistry({ publish: (notification) => published.push(notification) });
  return { published, registry };
}

const rowsOf = (notification: Notification | undefined) =>
  notification && notification.type === 'reports-changed' ? notification.rows : undefined;

const soundsGoodOf = (notification: Notification | undefined) =>
  notification && notification.type === 'reports-changed' ? notification.soundsGood : undefined;

describe('ReportRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts one row per category across sockets', () => {
    const { registry, published } = harness();

    expect(registry.record(1, 10, 'english', 'a', 'quiet')).toBe('accepted');
    expect(registry.record(1, 10, 'english', 'b', 'quiet')).toBe('accepted');

    expect(published).toHaveLength(2);
    expect(rowsOf(published[1])).toEqual([{ category: 'quiet', count: 2, ageMs: 0 }]);
  });

  it('refuses the same category from the same socket inside the cooldown and publishes nothing', () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    vi.advanceTimersByTime(REPORT_COOLDOWN_MS - 1000);

    expect(registry.record(1, 10, 'english', 'a', 'quiet')).toBe('too_soon');
    expect(published).toHaveLength(1);
  });

  it('accepts a different category from the same socket inside the cooldown', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');

    expect(registry.record(1, 10, 'english', 'a', 'silent')).toBe('accepted');
    expect(registry.tally(1, 10)).toEqual([
      { category: 'quiet', count: 1, ageMs: 0 },
      { category: 'silent', count: 1, ageMs: 0 },
    ]);
  });

  it('accepts the same category from the same socket once the cooldown has passed', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    vi.advanceTimersByTime(REPORT_COOLDOWN_MS);

    expect(registry.record(1, 10, 'english', 'a', 'quiet')).toBe('accepted');
    expect(registry.tally(1, 10)).toEqual([{ category: 'quiet', count: 2, ageMs: 0 }]);
  });

  it('resolves every active problem from one socket and keeps other listeners intact', () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    registry.record(1, 10, 'english', 'a', 'noise');
    registry.record(1, 10, 'english', 'b', 'quiet');

    expect(registry.resolve(1, 10, 'a')).toBe('accepted');
    expect(rowsOf(published.at(-1))).toEqual([{ category: 'quiet', count: 1, ageMs: 0 }]);
    expect(soundsGoodOf(published.at(-1))).toEqual({ count: 1, ageMs: 0 });
  });

  it('keeps resolution available after the negative entries age out', async () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    await vi.advanceTimersByTimeAsync(REPORT_WINDOW_MS);

    expect(registry.tally(1, 10)).toEqual([]);
    expect(registry.resolve(1, 10, 'a')).toBe('accepted');
    expect(soundsGoodOf(published.at(-1))).toEqual({ count: 1, ageMs: 0 });
  });

  it('expires a positive confirmation without dropping the problem window', async () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    registry.record(1, 10, 'english', 'b', 'noise');
    registry.resolve(1, 10, 'a');
    published.length = 0;
    await vi.advanceTimersByTimeAsync(REPORT_RESOLUTION_WINDOW_MS);

    expect(registry.snapshot(1, 10)).toEqual({
      rows: [{ category: 'noise', count: 1, ageMs: REPORT_RESOLUTION_WINDOW_MS }],
      soundsGood: null,
    });
    expect(soundsGoodOf(published.at(-1))).toBeNull();
  });

  it('accepts one resolution per reporting episode', () => {
    const { registry } = harness();

    expect(registry.resolve(1, 10, 'a')).toBe('not_open');
    registry.record(1, 10, 'english', 'a', 'quiet');
    expect(registry.resolve(1, 10, 'a')).toBe('accepted');
    expect(registry.resolve(1, 10, 'a')).toBe('not_open');
  });

  it('keeps the original category cooldown after resolving its visible report', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    registry.resolve(1, 10, 'a');

    expect(registry.record(1, 10, 'english', 'a', 'quiet')).toBe('too_soon');
    vi.advanceTimersByTime(REPORT_COOLDOWN_MS);
    expect(registry.record(1, 10, 'english', 'a', 'quiet')).toBe('accepted');
  });

  it('drops an entry older than the window from the tally', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    vi.advanceTimersByTime(REPORT_WINDOW_MS - 1000);
    registry.record(1, 10, 'english', 'b', 'noise');
    vi.advanceTimersByTime(1000);

    expect(registry.tally(1, 10)).toEqual([{ category: 'noise', count: 1, ageMs: 1000 }]);
  });

  it('publishes a shrinking tally on expiry with no new report, then an empty one', async () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    vi.advanceTimersByTime(1000);
    registry.record(1, 10, 'english', 'b', 'noise');
    published.length = 0;

    await vi.advanceTimersByTimeAsync(REPORT_WINDOW_MS - 1000);
    expect(rowsOf(published.at(-1))).toEqual([
      { category: 'noise', count: 1, ageMs: REPORT_WINDOW_MS - 1000 },
    ]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(rowsOf(published.at(-1))).toEqual([]);
  });

  it('publishes an empty tally when a non-empty channel is forgotten, and nothing otherwise', () => {
    const { registry, published } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    published.length = 0;

    registry.forgetChannel(1, 10);
    expect(rowsOf(published.at(-1))).toEqual([]);
    expect(published).toHaveLength(1);

    registry.forgetChannel(1, 10);
    expect(published).toHaveLength(1);
  });

  it('forgets every channel under an event', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    registry.record(1, 11, 'german', 'a', 'loud');

    registry.forgetEvent(1);

    expect(registry.tally(1, 10)).toEqual([]);
    expect(registry.tally(1, 11)).toEqual([]);
  });

  it('lifts the cooldown for a released socket while keeping its report counted', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');
    registry.releaseSocket('a');

    expect(registry.tally(1, 10)).toEqual([{ category: 'quiet', count: 1, ageMs: 0 }]);
    expect(registry.record(1, 10, 'english', 'b', 'quiet')).toBe('accepted');
    expect(registry.resolve(1, 10, 'a')).toBe('not_open');
  });

  it('scopes a tally to its own channel', () => {
    const { registry } = harness();

    registry.record(1, 10, 'english', 'a', 'quiet');

    expect(registry.tally(1, 11)).toEqual([]);
    expect(registry.tally(2, 10)).toEqual([]);
  });
});
