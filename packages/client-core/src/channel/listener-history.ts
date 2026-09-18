import { LISTENER_HISTORY_WINDOW_MS, type ListenerHistoryPoint } from '@linguacast/contract/socket';

/** A count anchored to this client's clock at receipt, rather than to a server timestamp. */
export interface AnchoredListenerPoint {
  count: number;
  at: number;
}

/** One vertex of the step line: the count that holds from `at` until the next row. */
export interface ListenerChartRow {
  count: number;
  at: number;
}

/**
 * The chart's horizontal resolution. Two changes closer together than this cannot be told
 * apart on screen, so drawing both only adds a spike nobody can read: a listener whose page
 * reloads would otherwise dip the line to zero and back inside one pixel column.
 */
export const LISTENER_CHART_BUCKET_MS = LISTENER_HISTORY_WINDOW_MS / 400;

/**
 * The wire carries `ageMs` rather than an absolute time, for the reason report rows do: a
 * client clock minutes off the server's would shift the whole series. Anchoring at receipt
 * fixes each point against this client's clock once, so time advances afterwards without
 * re-reading the server.
 */
export function anchorListenerHistory(
  points: readonly ListenerHistoryPoint[],
  now: number,
): AnchoredListenerPoint[] {
  return points.map((point) => ({ count: point.count, at: now - point.ageMs }));
}

/**
 * Drops points the chart can no longer reach, keeping the newest one older than the window:
 * that point carries the count the line holds from the window's left edge, and dropping it
 * would leave the first stretch of the chart undrawn.
 */
export function pruneListenerHistory(
  history: readonly AnchoredListenerPoint[],
  now: number,
): AnchoredListenerPoint[] {
  const windowStart = now - LISTENER_HISTORY_WINDOW_MS;
  let firstKept = 0;
  for (let index = 0; index < history.length; index += 1) {
    const point = history[index];
    // Ordered oldest first, so the first point inside the window settles the answer.
    if (point === undefined || point.at >= windowStart) {
      break;
    }
    firstKept = index;
  }
  return firstKept === 0 ? (history as AnchoredListenerPoint[]) : history.slice(firstKept);
}

/**
 * Extends the series from a per-change listener count. A repeat of the last count carries no
 * information — the line already holds that value to `now` — so it is dropped rather than
 * stored.
 */
export function appendListenerCount(
  history: readonly AnchoredListenerPoint[],
  count: number,
  now: number,
): AnchoredListenerPoint[] {
  const pruned = pruneListenerHistory(history, now);
  if (pruned.at(-1)?.count === count) {
    return pruned;
  }
  return [...pruned, { count, at: now }];
}

/**
 * Projects the series onto the chart's window. The first point is clamped to the window
 * start so the line begins at the left edge, points sharing a bucket collapse to that
 * bucket's last count, and a terminal row at `now` holds the last count flat to the right
 * edge — which is what advances the axis between updates with no new data.
 *
 * An empty series yields no rows: nothing is known, which is not the same as nobody
 * listening, and the caller withholds the chart instead of drawing a line at zero.
 */
export function listenerChartRows(
  history: readonly AnchoredListenerPoint[],
  now: number,
): ListenerChartRow[] {
  if (history.length === 0) {
    return [];
  }

  const windowStart = now - LISTENER_HISTORY_WINDOW_MS;
  const merged: ListenerChartRow[] = [];

  for (const point of history) {
    const at = Math.max(point.at, windowStart);
    const open = merged.at(-1);
    if (open !== undefined && at - open.at < LISTENER_CHART_BUCKET_MS) {
      merged[merged.length - 1] = { count: point.count, at: open.at };
      continue;
    }
    merged.push({ count: point.count, at });
  }

  // A repeated count draws nothing a step line does not already hold, and a merge can leave
  // one behind: a dip that recovered inside a bucket collapses back to the count before it.
  const rows = merged.filter((row, index) => index === 0 || merged[index - 1]?.count !== row.count);

  const last = rows.at(-1);
  if (last !== undefined && last.at !== now) {
    rows.push({ count: last.count, at: now });
  }
  return rows;
}

/** Every channel's series this socket has been sent, keyed by slug. */
export type ListenerHistoryState = Record<string, AnchoredListenerPoint[]>;

/**
 * Replaces a channel's series with the snapshot the server sends to the claim holder,
 * anchoring it at receipt because each point's `ageMs` is only true then.
 */
export function seedListenerHistory(
  state: ListenerHistoryState,
  slug: string,
  points: readonly ListenerHistoryPoint[],
  now: number,
): ListenerHistoryState {
  return { ...state, [slug]: anchorListenerHistory(points, now) };
}

/**
 * Extends a series this socket already holds and never starts one: a count arriving before
 * the snapshot would otherwise open a chart at that value, claiming the channel had no
 * earlier audience.
 */
export function extendListenerHistory(
  state: ListenerHistoryState,
  slug: string,
  count: number,
  now: number,
): ListenerHistoryState {
  const current = state[slug];
  if (current === undefined) {
    return state;
  }
  const next = appendListenerCount(current, count, now);
  return next === current ? state : { ...state, [slug]: next };
}

/**
 * Drops a channel's series. The audience belongs to whoever holds the claim, so a socket that
 * loses it withholds the chart rather than holding a line nobody is extending.
 */
export function forgetListenerHistory(
  state: ListenerHistoryState,
  slug: string,
): ListenerHistoryState {
  if (state[slug] === undefined) {
    return state;
  }
  const { [slug]: _gone, ...rest } = state;
  return rest;
}
