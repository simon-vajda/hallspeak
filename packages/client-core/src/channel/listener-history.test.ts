import { LISTENER_HISTORY_WINDOW_MS } from '@hallspeak/contract/socket';
import { describe, expect, it } from 'vitest';
import {
  type AnchoredListenerPoint,
  anchorListenerHistory,
  appendListenerCount,
  extendListenerHistory,
  forgetListenerHistory,
  LISTENER_CHART_BUCKET_MS,
  type ListenerHistoryState,
  listenerChartRows,
  pruneListenerHistory,
  seedListenerHistory,
} from './listener-history';

const NOW = 10_000_000;

describe('anchorListenerHistory', () => {
  it('anchors each point to the client clock at receipt', () => {
    expect(
      anchorListenerHistory(
        [
          { count: 0, ageMs: 600_000 },
          { count: 3, ageMs: 0 },
        ],
        NOW,
      ),
    ).toEqual([
      { count: 0, at: NOW - 600_000 },
      { count: 3, at: NOW },
    ]);
  });

  it('yields an empty series for an empty snapshot', () => {
    expect(anchorListenerHistory([], NOW)).toEqual([]);
  });
});

describe('appendListenerCount', () => {
  const history: AnchoredListenerPoint[] = [{ count: 2, at: NOW - 30_000 }];

  it('ignores a count equal to the last point, keeping the same series', () => {
    expect(appendListenerCount(history, 2, NOW)).toBe(history);
  });

  it('appends a different count at now', () => {
    expect(appendListenerCount(history, 5, NOW)).toEqual([
      { count: 2, at: NOW - 30_000 },
      { count: 5, at: NOW },
    ]);
  });

  it('appends to an empty series', () => {
    expect(appendListenerCount([], 0, NOW)).toEqual([{ count: 0, at: NOW }]);
  });

  it('prunes while appending', () => {
    const stale: AnchoredListenerPoint[] = [
      { count: 9, at: NOW - LISTENER_HISTORY_WINDOW_MS - 120_000 },
      { count: 4, at: NOW - LISTENER_HISTORY_WINDOW_MS - 60_000 },
      { count: 1, at: NOW - 10_000 },
    ];

    expect(appendListenerCount(stale, 7, NOW)).toEqual([
      { count: 4, at: NOW - LISTENER_HISTORY_WINDOW_MS - 60_000 },
      { count: 1, at: NOW - 10_000 },
      { count: 7, at: NOW },
    ]);
  });
});

describe('pruneListenerHistory', () => {
  it('keeps the newest point older than the window and drops the ones before it', () => {
    const history: AnchoredListenerPoint[] = [
      { count: 9, at: NOW - LISTENER_HISTORY_WINDOW_MS - 300_000 },
      { count: 6, at: NOW - LISTENER_HISTORY_WINDOW_MS - 1 },
      { count: 3, at: NOW - 5_000 },
    ];

    expect(pruneListenerHistory(history, NOW)).toEqual([
      { count: 6, at: NOW - LISTENER_HISTORY_WINDOW_MS - 1 },
      { count: 3, at: NOW - 5_000 },
    ]);
  });

  it('leaves a series with nothing to drop untouched', () => {
    const history: AnchoredListenerPoint[] = [{ count: 3, at: NOW - 5_000 }];

    expect(pruneListenerHistory(history, NOW)).toBe(history);
  });

  it('keeps a single stale point rather than emptying the series', () => {
    const history: AnchoredListenerPoint[] = [
      { count: 3, at: NOW - LISTENER_HISTORY_WINDOW_MS - 900_000 },
    ];

    expect(pruneListenerHistory(history, NOW)).toBe(history);
  });
});

describe('listenerChartRows', () => {
  it('clamps a point older than the window to the window start', () => {
    const rows = listenerChartRows(
      [{ count: 4, at: NOW - LISTENER_HISTORY_WINDOW_MS - 90_000 }],
      NOW,
    );

    expect(rows).toEqual([
      { count: 4, at: NOW - LISTENER_HISTORY_WINDOW_MS },
      { count: 4, at: NOW },
    ]);
  });

  it('ends with a row at now holding the last count', () => {
    const rows = listenerChartRows(
      [
        { count: 1, at: NOW - 900_000 },
        { count: 6, at: NOW - 400_000 },
      ],
      NOW,
    );

    expect(rows.at(-1)).toEqual({ count: 6, at: NOW });
  });

  it('merges a drop and a recovery inside one bucket, drawing no row at zero', () => {
    const rows = listenerChartRows(
      [
        { count: 5, at: NOW - 600_000 },
        { count: 0, at: NOW - 300_000 },
        { count: 5, at: NOW - 296_000 },
      ],
      NOW,
    );

    expect(rows.map((row) => row.count)).toEqual([5, 5]);
  });

  it('draws a drop that outlasts a bucket', () => {
    const rows = listenerChartRows(
      [
        { count: 5, at: NOW - 600_000 },
        { count: 0, at: NOW - 300_000 },
        { count: 5, at: NOW - 300_000 + LISTENER_CHART_BUCKET_MS * 2 },
      ],
      NOW,
    );

    expect(rows.map((row) => row.count)).toEqual([5, 0, 5, 5]);
  });

  it('yields no rows for an empty series, so the panel withholds rather than drawing zero', () => {
    expect(listenerChartRows([], NOW)).toEqual([]);
  });
});

describe('seedListenerHistory', () => {
  it('anchors the snapshot and leaves every other channel alone', () => {
    const state: ListenerHistoryState = { other: [{ count: 1, at: NOW - 1_000 }] };

    const next = seedListenerHistory(
      state,
      'en',
      [
        { count: 0, ageMs: 600_000 },
        { count: 3, ageMs: 0 },
      ],
      NOW,
    );

    expect(next.en).toEqual([
      { count: 0, at: NOW - 600_000 },
      { count: 3, at: NOW },
    ]);
    expect(next.other).toBe(state.other);
  });

  it('replaces a series rather than appending to it, so a rebind never doubles the line', () => {
    const state: ListenerHistoryState = { en: [{ count: 9, at: NOW - 500_000 }] };

    expect(seedListenerHistory(state, 'en', [{ count: 2, ageMs: 0 }], NOW).en).toEqual([
      { count: 2, at: NOW },
    ]);
  });
});

describe('extendListenerHistory', () => {
  it('extends a series this socket already holds', () => {
    const state: ListenerHistoryState = { en: [{ count: 1, at: NOW - 60_000 }] };

    expect(extendListenerHistory(state, 'en', 4, NOW).en).toEqual([
      { count: 1, at: NOW - 60_000 },
      { count: 4, at: NOW },
    ]);
  });

  it('starts no series for a channel with no snapshot yet', () => {
    const state: ListenerHistoryState = {};

    expect(extendListenerHistory(state, 'en', 4, NOW)).toBe(state);
  });

  it('holds the same state when the count repeats the last one', () => {
    const state: ListenerHistoryState = { en: [{ count: 4, at: NOW - 60_000 }] };

    expect(extendListenerHistory(state, 'en', 4, NOW)).toBe(state);
  });
});

describe('forgetListenerHistory', () => {
  it('drops the channel and keeps the rest', () => {
    const state: ListenerHistoryState = {
      en: [{ count: 4, at: NOW }],
      hu: [{ count: 1, at: NOW }],
    };

    const next = forgetListenerHistory(state, 'en');

    expect(next).not.toHaveProperty('en');
    expect(next.hu).toBe(state.hu);
  });

  it('holds the same state for a channel it never had', () => {
    const state: ListenerHistoryState = {};

    expect(forgetListenerHistory(state, 'en')).toBe(state);
  });
});
