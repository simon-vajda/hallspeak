import Storage from 'expo-sqlite/kv-store';
import type { RememberedEvent, Venue } from './types';

/** One key holding the whole list, so a partial write cannot leave two keys disagreeing. */
export const REMEMBERED_EVENTS_STORAGE_KEY = 'linguacast-remembered-events';

export const DEFAULT_REMEMBERED_EVENT: RememberedEvent = {
  host: '',
  pin: '',
  name: '',
  lastConnectedAt: null,
  pinned: false,
  unavailable: false,
};

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function timestamp(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseRecord(value: unknown): RememberedEvent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const stored = value as Record<string, unknown>;
  const host = text(stored.host, DEFAULT_REMEMBERED_EVENT.host);
  const pin = text(stored.pin, DEFAULT_REMEMBERED_EVENT.pin);
  // Host and PIN are the identity; unlike every other field they have no meaningful default,
  // so an entry missing either is dropped rather than degraded.
  if (host === '' || pin === '') {
    return null;
  }

  return {
    host,
    pin,
    name: text(stored.name, DEFAULT_REMEMBERED_EVENT.name),
    lastConnectedAt: timestamp(stored.lastConnectedAt, DEFAULT_REMEMBERED_EVENT.lastConnectedAt),
    pinned: boolean(stored.pinned, DEFAULT_REMEMBERED_EVENT.pinned),
    unavailable: boolean(stored.unavailable, DEFAULT_REMEMBERED_EVENT.unavailable),
  };
}

/**
 * Total by design: every field falls back on its own, so a partial or hand-edited entry still
 * yields a usable record and a corrupt value yields an empty list rather than an exception.
 */
export function parseStoredEvents(raw: string | null): RememberedEvent[] {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(parseRecord).filter((entry): entry is RememberedEvent => entry !== null);
}

export function sortRememberedEvents(events: RememberedEvent[]): RememberedEvent[] {
  return [...events].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0);
  });
}

function sameVenue(event: RememberedEvent, host: string, pin: string): boolean {
  return event.host === host && event.pin === pin;
}

async function readAll(): Promise<RememberedEvent[]> {
  return parseStoredEvents(await Storage.getItem(REMEMBERED_EVENTS_STORAGE_KEY));
}

async function writeAll(events: RememberedEvent[]): Promise<void> {
  await Storage.setItem(REMEMBERED_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

/**
 * The history list. It is a record of where a listener has been, never a precondition for
 * going there: opening an event needs a host and a PIN and nothing from here.
 */
export async function readRememberedEvents(): Promise<RememberedEvent[]> {
  return sortRememberedEvents(await readAll());
}

async function update(
  host: string,
  pin: string,
  change: (event: RememberedEvent) => RememberedEvent,
): Promise<void> {
  const events = await readAll();
  const index = events.findIndex((event) => sameVenue(event, host, pin));
  if (index === -1) {
    return;
  }

  const existing = events[index];
  if (!existing) {
    return;
  }

  events[index] = change(existing);
  await writeAll(events);
}

/** Written as a side effect of a successful open, which is the only thing that adds a row. */
export async function rememberSuccessfulOpen(
  venue: Venue & { name: string },
  at: number,
): Promise<void> {
  const events = await readAll();
  const existing = events.find((event) => sameVenue(event, venue.host, venue.pin));
  const updated: RememberedEvent = {
    ...DEFAULT_REMEMBERED_EVENT,
    ...existing,
    host: venue.host,
    pin: venue.pin,
    name: venue.name,
    lastConnectedAt: at,
    unavailable: false,
  };

  await writeAll([...events.filter((event) => !sameVenue(event, venue.host, venue.pin)), updated]);
}

/** A no-op for a venue that was never remembered: a failed open never adds a row. */
export async function markEventUnavailable(host: string, pin: string): Promise<void> {
  await update(host, pin, (event) => ({ ...event, unavailable: true }));
}

export async function setEventPinned(host: string, pin: string, pinned: boolean): Promise<void> {
  await update(host, pin, (event) => ({ ...event, pinned }));
}

export async function forgetEvent(host: string, pin: string): Promise<void> {
  const events = await readAll();
  await writeAll(events.filter((event) => !sameVenue(event, host, pin)));
}
