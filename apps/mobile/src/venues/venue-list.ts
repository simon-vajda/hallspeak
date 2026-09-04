import { sortRememberedEvents } from './storage';
import type { RememberedEvent } from './types';

export type VenueRow = {
  /** Host and PIN together: one host can carry many events and one PIN many hosts. */
  key: string;
  host: string;
  pin: string;
  name: string;
  pinned: boolean;
  unavailable: boolean;
  /** Null for an event that has never been opened, so no placeholder date is invented. */
  lastConnectedLabel: string | null;
  unavailableLabel: string | null;
};

export type VenueSectionId = 'pinned' | 'recent';

export type VenueSection = {
  id: VenueSectionId;
  title: string;
  rows: VenueRow[];
};

export type VenueListView = { kind: 'empty' } | { kind: 'sections'; sections: VenueSection[] };

/** Names no cause: a regenerated PIN, a removed event and an unreachable host are one outcome. */
const UNAVAILABLE_LABEL = "Didn't open last time";

export const EMPTY_STATE = {
  title: 'No venues yet',
  body: 'Scan the code at your venue and it will be waiting here the next time you come.',
} as const;

export const STORAGE_NOTE =
  'Kept on this phone only. Each event is remembered with the address that hosts it.';

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
] as const;

/**
 * A host is identity, not a link: whatever a record happens to hold, only the authority is
 * ever shown, so no listener reads a full event URL back off their own home screen.
 */
export function displayHost(host: string): string {
  const withoutScheme = host.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const [authority = ''] = withoutScheme.split('/');
  return authority;
}

/**
 * Written by hand rather than through `Intl`, whose month names and ordering vary by platform
 * and device locale while this line has one approved wording.
 */
function formatLastConnected(at: number | null, now: number): string | null {
  if (at === null) {
    return null;
  }

  const date = new Date(at);
  const month = MONTHS[date.getMonth()];
  if (month === undefined) {
    return null;
  }

  const year = date.getFullYear();
  const suffix = year === new Date(now).getFullYear() ? '' : ` ${year}`;
  return `Last joined ${date.getDate()} ${month}${suffix}`;
}

function toRow(event: RememberedEvent, now: number): VenueRow {
  return {
    key: `${event.host}/${event.pin}`,
    host: displayHost(event.host),
    pin: event.pin,
    name: event.name,
    pinned: event.pinned,
    unavailable: event.unavailable,
    lastConnectedLabel: formatLastConnected(event.lastConnectedAt, now),
    unavailableLabel: event.unavailable ? UNAVAILABLE_LABEL : null,
  };
}

/**
 * The whole home screen as data. Every field comes from device memory: the list makes no
 * claim about an event that could only be answered by its host.
 */
export function buildVenueList(events: RememberedEvent[], now: number = Date.now()): VenueListView {
  if (events.length === 0) {
    return { kind: 'empty' };
  }

  const sorted = sortRememberedEvents(events);
  const sections: VenueSection[] = [];
  const pinned = sorted.filter((event) => event.pinned).map((event) => toRow(event, now));
  const recent = sorted.filter((event) => !event.pinned).map((event) => toRow(event, now));

  if (pinned.length > 0) {
    sections.push({ id: 'pinned', title: 'Pinned', rows: pinned });
  }
  if (recent.length > 0) {
    sections.push({ id: 'recent', title: 'Recent', rows: recent });
  }

  return { kind: 'sections', sections };
}
