import type { ListenerChartRow } from '@linguacast/client-core/channel';
import { LISTENER_HISTORY_WINDOW_MS } from '@linguacast/contract/socket';
import { plural } from '@/lib/format';

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

/** Axis copy: the age of a tick, which is what the fixed window's three labels describe. */
export function listenerTickLabel(at: number, now: number): string {
  const minutes = Math.round((now - at) / MINUTE_MS);
  return minutes <= 0 ? 'now' : `${minutes}m ago`;
}

/**
 * Wall-clock time in the viewer's own locale, so a US studio reads `2:05 PM` and a Hungarian
 * one `14:05` without the panel choosing a clock for either.
 */
export function listenerPointTime(at: number, locales?: Intl.LocalesArgument): string {
  return new Date(at).toLocaleTimeString(locales, { hour: 'numeric', minute: '2-digit' });
}

/** Zero for an empty series: there is no peak to state, and the caller withholds the chart. */
export function listenerPeak(rows: readonly ListenerChartRow[]): number {
  return rows.reduce((peak, row) => Math.max(peak, row.count), 0);
}

/** The chart is decorative to a screen reader; this sentence carries it instead. */
export function listenerChartSummary(rows: readonly ListenerChartRow[]): string {
  const latest = rows.at(-1);
  if (latest === undefined) {
    return LISTENER_HISTORY_WITHHELD;
  }
  return `${plural(latest.count, 'listener')}, peak ${listenerPeak(rows)} in the last hour.`;
}

/** Tooltip copy: the recorded count and the clock time it was recorded at, and nothing else. */
export function listenerPointLabel(
  count: number,
  at: number,
  locales?: Intl.LocalesArgument,
): string {
  return `${plural(count, 'listener')} · ${listenerPointTime(at, locales)}`;
}
