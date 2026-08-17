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
  console.error('Unhandled error:', err);
  return { code: 'internal_error', message: 'An unexpected error occurred.' };
}
