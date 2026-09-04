import type { components } from '@linguacast/contract/openapi';

/** The public event payload, taken from the contract rather than restated here. */
export type PublicEvent = components['schemas']['PublicEvent'];
export type PublicChannel = components['schemas']['PublicChannel'];

/** Everything needed to open an event: no stored record is ever consulted to perform one. */
export type Venue = {
  /** Host and optional port, with no scheme and no path. */
  host: string;
  pin: string;
};

export type LinkRefusalReason =
  | 'empty'
  | 'not_a_link'
  | 'insecure_scheme'
  | 'missing_pin'
  | 'invalid_pin';

export type ParsedListenerLink =
  | { ok: true; venue: Venue }
  | { ok: false; reason: LinkRefusalReason };

export type RememberedEvent = Venue & {
  name: string;
  /** Epoch milliseconds, or null for an event that has never been opened successfully. */
  lastConnectedAt: number | null;
  pinned: boolean;
  /**
   * Set when the last open failed and cleared by the next success. It names no cause: a
   * regenerated PIN, a disabled event and an unreachable host are one outcome.
   */
  unavailable: boolean;
};

/**
 * A missing event and a wrong PIN are deliberately one outcome, matching the server's 404
 * parity. `unreachable` covers every other failure and makes no claim about its cause.
 */
export type EventLookup =
  | { outcome: 'verified'; event: PublicEvent }
  | { outcome: 'not_found' }
  | { outcome: 'unreachable' };
