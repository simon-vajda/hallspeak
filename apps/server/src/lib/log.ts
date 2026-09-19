import { env } from '../env';

/**
 * Every line the server writes goes through here, in one of two tiers.
 *
 * The always-on tier is sized to answer a support ticket on its own: a self-hosted
 * deployment has no monitoring stack, so whatever an operator can paste out of
 * `docker compose logs` is the entire telemetry budget. It carries deployment facts,
 * failures, and a per-channel timeline whose volume does not grow with listener count.
 *
 * The verbose tier carries the per-connection narration — transport lifecycle, ICE and
 * DTLS states, candidate addresses. It is off unless the operator turns it on, because a
 * hundred-listener event buries every always-on line under a thousand that do not matter.
 */

/**
 * Closed on purpose: `logger` takes one of these and nothing else, so a typo cannot split
 * one subsystem's lines across two prefixes nobody thinks to correlate.
 */
export type Subsystem =
  | 'boot'
  | 'channel'
  | 'error'
  | 'media'
  | 'notifications'
  | 'proxy'
  | 'socket';

export interface TierWriters {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
}

export interface Logger extends TierWriters {
  /** Suppressed entirely unless the operator enabled the verbose tier. */
  readonly verbose: TierWriters;
  /** Writes the first time this key is seen in the process, then stays silent. */
  warnOnce(key: string, message: string): void;
}

/**
 * Bounded because one of the keys carries an address the caller chose: a client appending
 * a forwarded header from a fresh address each time would otherwise mint keys for the life
 * of the process. Past the cap the condition stays true and stays unsaid — by then the
 * operator has more examples than they need.
 */
const MAX_ONCE_KEYS = 50;
const seenKeys = new Set<string>();

function compose(subsystem: Subsystem, message: string): string {
  // Self-emitted rather than left to the runtime: container runtimes timestamp only when
  // asked and journald rewrites what it captures, so this is the only value that survives
  // an arbitrary copy-paste into a ticket.
  return `${new Date().toISOString()} ${subsystem}: ${message}`;
}

function writers(subsystem: Subsystem, gated: boolean): TierWriters {
  const enabled = (): boolean => !gated || env.LOG_VERBOSE;
  return {
    info(message) {
      if (enabled()) {
        console.log(compose(subsystem, message));
      }
    },
    warn(message) {
      if (enabled()) {
        console.warn(compose(subsystem, message));
      }
    },
    error(message, cause) {
      if (!enabled()) {
        return;
      }
      const line = compose(subsystem, message);
      if (cause === undefined) {
        console.error(line);
      } else {
        console.error(line, cause);
      }
    },
  };
}

/** Tests only, in the shape of `resetAuth()`: a suite needs the first-call state back. */
export function resetOnceWarnings(): void {
  seenKeys.clear();
}

export function logger(subsystem: Subsystem): Logger {
  const always = writers(subsystem, false);
  return {
    ...always,
    verbose: writers(subsystem, true),
    warnOnce(key, message) {
      if (seenKeys.has(key) || seenKeys.size >= MAX_ONCE_KEYS) {
        return;
      }
      seenKeys.add(key);
      always.warn(message);
    },
  };
}
