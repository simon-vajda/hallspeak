import type { HistoryEntry } from '@/history/history';
import { displayHost } from '@/links/host';

export type HistorySections = {
  pinned: HistoryEntry[];
  recent: HistoryEntry[];
};

/**
 * A pinned row outranks a more recent unpinned one: pinning is the guest saying this is the
 * event they attend, which no date can outweigh. Within a section the newest is first.
 */
export function sectionHistory(entries: HistoryEntry[]): HistorySections {
  const byRecency = (a: HistoryEntry, b: HistoryEntry) => b.lastJoinedAt - a.lastJoinedAt;

  return {
    pinned: entries.filter((entry) => entry.pinned).sort(byRecency),
    recent: entries.filter((entry) => !entry.pinned).sort(byRecency),
  };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Written out rather than taken from `Intl`, whose availability and locale data vary across
 * Hermes builds — and this run's copy is English throughout, so a locale-aware format would
 * be the only translated string in the app.
 */
export function formatLastJoined(at: number, now: number = Date.now()): string {
  const date = new Date(at);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = MONTHS[date.getMonth()] ?? '';
  const sameYear = date.getFullYear() === new Date(now).getFullYear();

  return sameYear
    ? `${date.getDate()} ${month}`
    : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** The host as a bare domain — no scheme, no path — beside the date the guest last opened it. */
export function rowSubtitle(entry: HistoryEntry, now: number = Date.now()): string {
  const date = formatLastJoined(entry.lastJoinedAt, now);
  const host = displayHost(entry.host);

  return date === '' ? host : `${host} · ${date}`;
}

export const EMPTY_HISTORY_TITLE = 'No events yet';
export const EMPTY_HISTORY_BODY =
  'Scan the code at your venue, or enter its link. Events you open are kept on this phone.';

export const HISTORY_FOOTER =
  'Kept on this phone only. Each event is remembered with the address that hosts it.';

/** Named per row so a screen reader announces which event an action applies to. */
export function pinActionLabel(entry: HistoryEntry): string {
  return entry.pinned ? `Unpin ${entry.name}` : `Pin ${entry.name}`;
}

export function removeActionLabel(entry: HistoryEntry): string {
  return `Remove ${entry.name}`;
}
