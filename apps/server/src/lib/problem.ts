import { logger } from './log';

const log = logger('error');

/** Mirrors the Problem schema in @linguacast/contract/schemas. */
export interface Problem {
  code: string;
  message: string;
}

/** Errors whose code and message are safe to show a client. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Maps any thrown value to the wire error shape: an AppError keeps its code, anything
 * else becomes internal_error with the original logged. Used by both transports.
 */
export function toProblem(err: unknown): Problem {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message };
  }
  // Name, message and stack only. A socket handler's state carries the event PIN, so
  // reproducing an arbitrary thrown value here would put a listening credential into the
  // log an operator is told to paste into a ticket. Redaction does not cover it: the paths
  // are fixed spellings at a fixed depth, and a credential nested anywhere below a thrown
  // value's own properties would pass through them.
  if (err instanceof Error) {
    log.error({ err: bare(err) }, 'unhandled error');
  } else {
    log.error({ thrownType: typeof err }, 'unhandled non-Error thrown');
  }
  return { code: 'internal_error', message: 'An unexpected error occurred.' };
}

/**
 * A thrown value's own properties do not survive into the log, and the three that do are
 * rebuilt here rather than deleted off the original, which callers up the stack still own.
 */
function bare(err: Error): Error {
  const copy = new Error(err.message);
  copy.stack = err.stack ?? `${err.name}: ${err.message}`;
  return copy;
}
