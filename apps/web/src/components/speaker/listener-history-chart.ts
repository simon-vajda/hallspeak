import type { ListenerChartRow } from '@linguacast/client-core/channel';
import { LISTENER_HISTORY_WINDOW_MS } from '@linguacast/contract/socket';

const MINUTE_MS = 60_000;

export const LISTENER_HISTORY_HEADING = 'Listeners · last hour';

/**
 * An empty series is a reading nobody has sent, not a reading of zero, so the summary says
 * what is missing rather than naming a count the panel does not have.
 */
export const LISTENER_HISTORY_WITHHELD = 'Listener history is not available yet.';

/** The horizontal extent, fixed to the window the server keeps rather than to the data. */
export function listenerChartDomain(now: number): [number, number] {
  return [now - LISTENER_HISTORY_WINDOW_MS, now];
}

/** Both window edges and its midpoint; a denser axis repeats the same two words. */
export function listenerChartTicks(now: number): number[] {
  const [start] = listenerChartDomain(now);
  return [start, start + LISTENER_HISTORY_WINDOW_MS / 2, now];
}

export function listenerTickLabel(at: number, now: number): string {
  const minutes = Math.round((now - at) / MINUTE_MS);
  return minutes <= 0 ? 'now' : `${minutes}m ago`;
}

/** Zero for an empty series: there is no peak to state, and the caller withholds the chart. */
export function listenerPeak(rows: readonly ListenerChartRow[]): number {
  return rows.reduce((peak, row) => Math.max(peak, row.count), 0);
}

function countPhrase(count: number): string {
  return `${count} ${count === 1 ? 'listener' : 'listeners'}`;
}

/** The chart is decorative to a screen reader; this sentence carries it instead. */
export function listenerChartSummary(rows: readonly ListenerChartRow[]): string {
  const latest = rows.at(-1);
  if (latest === undefined) {
    return LISTENER_HISTORY_WITHHELD;
  }
  return `${countPhrase(latest.count)}, peak ${listenerPeak(rows)} in the last hour.`;
}

/** Tooltip copy: the recorded count and when it was recorded, and nothing beyond that. */
export function listenerPointLabel(count: number, at: number, now: number): string {
  return `${countPhrase(count)} · ${listenerTickLabel(at, now)}`;
}
