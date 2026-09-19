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

const seenKeys = new Set<string>();

function compose(subsystem: string, message: string): string {
  // Self-emitted rather than left to the runtime: container runtimes timestamp only when
  // asked and journald rewrites what it captures, so this is the only value that survives
  // an arbitrary copy-paste into a ticket.
  return `${new Date().toISOString()} ${subsystem}: ${message}`;
}

function writers(subsystem: string, gated: boolean): TierWriters {
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

export function logger(subsystem: string): Logger {
  const always = writers(subsystem, false);
  return {
    ...always,
    verbose: writers(subsystem, true),
    warnOnce(key, message) {
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      always.warn(message);
    },
  };
}
