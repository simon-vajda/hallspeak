const RETRYABLE_CODES = new Set(['internal_error', 'unavailable']);

const MAX_RETRIES = 3;

export function apiProblemCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

export function apiProblemMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }

  return typeof error.message === 'string' ? error.message : undefined;
}

/** Retry transport and server failures, never a domain refusal the same request cannot fix. */
export function shouldRetryApiQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }

  const code = apiProblemCode(error);
  return code === undefined || RETRYABLE_CODES.has(code);
}
