import type { ListenerChartRow } from '@linguacast/client-core/channel';
import { LISTENER_HISTORY_WINDOW_MS } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import {
  LISTENER_HISTORY_HEADING,
  LISTENER_HISTORY_WITHHELD,
  listenerChartDomain,
  listenerChartSummary,
  listenerChartTicks,
  listenerPeak,
  listenerPointLabel,
  listenerTickLabel,
} from './listener-history-chart';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

const row = (count: number, minutesAgo: number): ListenerChartRow => ({
  count,
  at: NOW - minutesAgo * MINUTE,
});

describe('listener history chart', () => {
  it('spans the whole window up to now', () => {
    expect(listenerChartDomain(NOW)).toEqual([NOW - LISTENER_HISTORY_WINDOW_MS, NOW]);
    expect(LISTENER_HISTORY_WINDOW_MS).toBe(60 * MINUTE);
  });

  it('labels the window edges and its midpoint', () => {
    expect(listenerChartTicks(NOW).map((tick) => listenerTickLabel(tick, NOW))).toEqual([
      '60m ago',
      '30m ago',
      'now',
    ]);
  });

  it('reads a tick inside the last minute as now', () => {
    expect(listenerTickLabel(NOW - 20_000, NOW)).toBe('now');
  });

  it('peaks over the visible rows only', () => {
    const rows = [row(4, 50), row(20, 40), row(12, 5), row(12, 0)];

    expect(listenerPeak(rows)).toBe(20);
    // A busier stretch pruned out of the window cannot raise the peak still on screen.
    expect(listenerPeak(rows.slice(2))).toBe(12);
    expect(listenerPeak([])).toBe(0);
  });

  it('summarises the latest count and the peak', () => {
    const summary = listenerChartSummary([row(4, 50), row(20, 40), row(12, 5), row(12, 0)]);

    expect(summary).toContain('12');
    expect(summary).toContain('20');
    expect(summary).not.toBe(LISTENER_HISTORY_WITHHELD);
  });

  it('withholds rather than reporting zero when nothing is known', () => {
    expect(listenerChartSummary([])).toBe(LISTENER_HISTORY_WITHHELD);
    expect(LISTENER_HISTORY_WITHHELD).not.toMatch(/\b0\b|zero|nobody|no one/i);
  });

  it('counts one listener in the singular', () => {
    expect(listenerChartSummary([row(1, 0)])).toContain('1 listener');
    expect(listenerChartSummary([row(1, 0)])).not.toContain('1 listeners');
    expect(listenerPointLabel(1, NOW, NOW)).toContain('1 listener');
  });

  it('states a count and a time in a point label, and nothing else', () => {
    expect(listenerPointLabel(12, NOW - 30 * MINUTE, NOW)).toBe('12 listeners · 30m ago');
    expect(listenerPointLabel(12, NOW, NOW)).toBe('12 listeners · now');
  });

  it('never claims anybody is hearing the audio', () => {
    const copy = [
      LISTENER_HISTORY_HEADING,
      LISTENER_HISTORY_WITHHELD,
      listenerChartSummary([]),
      listenerChartSummary([row(0, 30), row(12, 5), row(12, 0)]),
      listenerPointLabel(12, NOW - MINUTE, NOW),
      ...listenerChartTicks(NOW).map((tick) => listenerTickLabel(tick, NOW)),
    ].join(' ');

    expect(copy).not.toMatch(/hearing|hears|listening|audience|everyone|everybody|on air/i);
  });
});
