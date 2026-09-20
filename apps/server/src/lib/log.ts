import { accessSync, constants, mkdirSync } from 'node:fs';
import pino from 'pino';
import { env } from '../env';

/**
 * Every line the server writes goes through here, at one of pino's levels.
 *
 * `info` and above is sized to answer a support ticket on its own: a self-hosted
 * deployment has no monitoring stack, so whatever an operator can paste out of
 * `docker compose logs` is the entire telemetry budget. It carries deployment facts,
 * failures, and a per-channel timeline whose volume does not grow with listener count.
 *
 * `debug` carries the per-connection narration — transport lifecycle, ICE and DTLS
 * states. `trace` carries what names a listener: a forwarded address, a remote candidate.
 * That split is the whole reason `trace` exists as a level of its own, because turning it
 * on writes those addresses to disk for the retention window, not just to a screen.
 *
 * Values are passed as fields, never interpolated into the message, so the same event
 * produces the same `msg` and the redaction below has something to act on: pino censors
 * serialized field paths and never inspects the message string.
 */

/**
 * Closed on purpose: `logger` takes one of these and nothing else, so a typo cannot split
 * one subsystem's lines across two names nobody thinks to correlate.
 */
export type Subsystem =
  | 'boot'
  | 'channel'
  | 'error'
  | 'media'
  | 'notifications'
  | 'proxy'
  | 'socket';

export type Fields = Record<string, unknown>;

export interface Writer {
  (fields: Fields, message: string): void;
  (message: string): void;
}

export interface Logger {
  /** pino's own gate, writable so a suite can move it without rebuilding the module. */
  level: string;
  readonly error: Writer;
  readonly warn: Writer;
  readonly info: Writer;
  readonly debug: Writer;
  readonly trace: Writer;
  /** Writes the first time this key is seen in the process, then stays silent. */
  warnOnce(key: string, fields: Fields, message: string): void;
}

/**
 * Every spelling these secrets take at a call site, each also one level down, because
 * they arrive inside request and handshake payloads. pino matches a configured path
 * exactly and has no recursive wildcard, so a spelling left out is a spelling logged.
 */
const REDACTED_KEYS = [
  'pin',
  'speakerCode',
  'speaker_code',
  'sessionId',
  'fromSessionId',
  'toSessionId',
  'studioSession',
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
];

const REDACTED_PATHS = REDACTED_KEYS.flatMap((key) => [key, `*.${key}`]);

/** Daily files with a fortnight kept, so the directory has a ceiling an operator can state. */
const LOG_FILE_FREQUENCY = 'daily';
const LOG_FILE_COUNT = 14;
/** Without this a rotated file is numbered but not dated, and says nothing about when it is from. */
const LOG_FILE_DATE_FORMAT = 'yyyy-MM-dd';

/**
 * Bounded because a key may carry a value the caller chose: a client appending a forwarded
 * header from a fresh address each time would otherwise mint keys for the life of the
 * process. Past the cap that condition stays true and stays unsaid — by then the operator
 * has more examples than they need.
 *
 * The cap is per family — the key up to its last colon — rather than global, so filling
 * one condition's key space cannot silence a different condition that has not warned yet.
 */
const MAX_ONCE_KEYS_PER_FAMILY = 50;
const seenKeys = new Set<string>();
const familySizes = new Map<string, number>();

function admitOnce(key: string): boolean {
  if (seenKeys.has(key)) {
    return false;
  }
  const family = key.slice(0, key.lastIndexOf(':') + 1) || key;
  const size = familySizes.get(family) ?? 0;
  if (size >= MAX_ONCE_KEYS_PER_FAMILY) {
    return false;
  }
  seenKeys.add(key);
  familySizes.set(family, size + 1);
  return true;
}

export interface LogTarget {
  target: string;
  level: string;
  options: Record<string, unknown>;
}

/**
 * Each target carries the level explicitly. A target with none defaults to `info` and
 * drops `debug` and `trace` silently even when the root logger admits them, which is the
 * one failure in this module that looks like working software.
 */
export function logTargets(level: string, directory: string, colorize: boolean): LogTarget[] {
  const targets: LogTarget[] = [
    {
      target: 'pino-pretty',
      level,
      // The paste-into-a-ticket contract in the operator guide is what stdout is for, in
      // production as much as in development. The fields folded into the sentence are
      // dropped from the object so they are not printed twice.
      options: {
        colorize,
        messageFormat: '{subsystem}: {msg}',
        ignore: 'pid,hostname,subsystem',
      },
    },
  ];
  if (directory) {
    targets.push({
      target: 'pino-roll',
      level,
      options: {
        file: `${directory}/linguacast.log`,
        frequency: LOG_FILE_FREQUENCY,
        dateFormat: LOG_FILE_DATE_FORMAT,
        limit: { count: LOG_FILE_COUNT },
      },
    });
  }
  return targets;
}

/**
 * Returns the directory to write into, or nothing when it cannot be used. A misconfigured
 * path is not worth an event: a failing target takes its sibling down with it, so the file
 * target is never constructed unless the directory is known good.
 */
export function prepareLogDirectory(directory: string): string {
  if (!directory) {
    return '';
  }
  try {
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK);
    return directory;
  } catch (cause) {
    // The message alone: a stack trace of an operator's wrong path helps nobody, and this
    // is the one record written before the logger exists to carry it.
    console.warn(
      `${new Date().toISOString()} boot: log directory ${directory} is unusable, ` +
        `continuing on stdout alone (${cause instanceof Error ? cause.message : String(cause)})`,
    );
    return '';
  }
}

type Destination = pino.DestinationStream & {
  flush?: (callback?: (error?: Error | null) => void) => void;
};

let destination: Destination | undefined;

function buildDestination(): Destination {
  // A suite that writes before installing its own destination would otherwise start a
  // worker thread and a real log file beside the repository.
  if (env.NODE_ENV === 'test') {
    return { write: () => {} };
  }
  const transport = pino.transport({
    targets: logTargets(env.LOG_LEVEL, prepareLogDirectory(env.LOG_DIR), process.stdout.isTTY),
  });
  // Without a listener a target that fails later throws out of the worker and takes the
  // process with it. Logging stops; the event does not.
  transport.on('error', () => {});
  return transport;
}

function sink(): Destination {
  destination ??= buildDestination();
  return destination;
}

const root = pino(
  {
    level: env.LOG_LEVEL,
    // Self-emitted rather than left to the runtime: container runtimes timestamp only
    // when asked and journald rewrites what it captures, so this is the only value that
    // survives an arbitrary copy-paste into a ticket.
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  },
  // Resolved per write, so a suite can install its own destination and so the transport's
  // worker threads start only in a process that actually logs.
  { write: (chunk: string) => sink().write(chunk) },
);

/** Tests only, in the shape of `resetAuth()`: a suite needs the first-call state back. */
export function resetOnceWarnings(): void {
  seenKeys.clear();
  familySizes.clear();
}

/** Tests only: records go to this stream instead of the transport. */
export function useLogDestination(stream: Destination): void {
  destination = stream;
}

/**
 * Transports run on worker threads and `process.exit()` does not wait for them, so the
 * last records before a shutdown — the ones an operator most wants — are exactly the ones
 * that would be lost without this.
 */
export function flushLogs(done: () => void): void {
  const stream = destination;
  if (!stream?.flush) {
    done();
    return;
  }
  let finished = false;
  const finish = (): void => {
    if (!finished) {
      finished = true;
      done();
    }
  };
  try {
    stream.flush(finish);
  } catch {
    finish();
  }
}

export function logger(subsystem: Subsystem): Logger {
  const child = root.child({ subsystem });
  return Object.assign(child, {
    warnOnce(key: string, fields: Fields, message: string): void {
      if (admitOnce(key)) {
        child.warn(fields, message);
      }
    },
  }) as unknown as Logger;
}
