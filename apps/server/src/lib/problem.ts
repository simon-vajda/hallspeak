/** The shared error shape. Mirrors the Problem schema in @linguacast/contract/schemas. */
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
 * Maps any thrown value to the wire error shape. Known errors keep their code;
 * everything else becomes internal_error, with the original logged server-side.
 * Transport-agnostic by design: HTTP responses and socket acks both use this.
 */
export function toProblem(err: unknown): Problem {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message };
  }
  console.error('Unhandled error:', err);
  return { code: 'internal_error', message: 'An unexpected error occurred.' };
}
