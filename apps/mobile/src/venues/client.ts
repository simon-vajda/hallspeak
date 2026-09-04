import { markEventUnavailable, rememberSuccessfulOpen } from './storage';
import type { EventLookup, PublicEvent } from './types';

/** The app speaks HTTPS only, so the scheme is a constant rather than stored data. */
const SCHEME = 'https://';

function isPublicEvent(value: unknown): value is PublicEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.pin === 'string' && typeof event.name === 'string' && Array.isArray(event.channels)
  );
}

/**
 * Addressed to the host it belongs to, rebuilt per call: there is no app-wide base URL and no
 * assumption that two remembered events share a server.
 *
 * Only a 404 becomes `not_found`, so a disabled event and an unknown PIN stay indistinguishable
 * as the server intends. Every other failure is `unreachable` and names no cause — React Native
 * reports an untrusted certificate and an unreachable host identically.
 */
export async function fetchPublicEvent(host: string, pin: string): Promise<EventLookup> {
  let response: Response;
  try {
    response = await fetch(`${SCHEME}${host}/api/events/${encodeURIComponent(pin)}`, {
      headers: { accept: 'application/json' },
    });
  } catch {
    return { outcome: 'unreachable' };
  }

  if (response.status === 404) {
    return { outcome: 'not_found' };
  }
  if (!response.ok) {
    return { outcome: 'unreachable' };
  }

  try {
    const body: unknown = await response.json();
    return isPublicEvent(body) ? { outcome: 'verified', event: body } : { outcome: 'unreachable' };
  } catch {
    return { outcome: 'unreachable' };
  }
}

/**
 * The one entry point a screen calls. Storage is written afterwards and never read first: a
 * scanned code opens an event that was never remembered, and a failed open adds nothing.
 */
export async function openEvent(
  host: string,
  pin: string,
  at: number = Date.now(),
): Promise<EventLookup> {
  const lookup = await fetchPublicEvent(host, pin);
  if (lookup.outcome === 'verified') {
    await rememberSuccessfulOpen({ host, pin, name: lookup.event.name }, at);
  } else {
    await markEventUnavailable(host, pin);
  }
  return lookup;
}
