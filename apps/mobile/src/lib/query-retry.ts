// Copied verbatim from `apps/web/src/lib/query-retry.ts`, including the two exports this app
// has no caller for yet. Byte-identity is the point: it is what makes lifting this into a
// shared package later a move rather than a merge.

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

/** Surface terminal refetch failures that suspense queries otherwise hide behind cached data. */
export function shouldThrowSettledQueryError(error: unknown, isFetching: boolean): boolean {
  return error !== null && error !== undefined && !isFetching;
}
