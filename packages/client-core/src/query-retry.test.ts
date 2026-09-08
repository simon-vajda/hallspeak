import { describe, expect, it } from 'vitest';
import { shouldRetryApiQuery, shouldThrowSettledQueryError } from './query-retry';

describe('shouldRetryApiQuery', () => {
  it.each(['unavailable', 'internal_error'])('retries %s up to three times', (code) => {
    expect(shouldRetryApiQuery(0, { code })).toBe(true);
    expect(shouldRetryApiQuery(2, { code })).toBe(true);
    expect(shouldRetryApiQuery(3, { code })).toBe(false);
  });

  it.each(['not_found', 'invalid_speaker_code', 'rate_limited', 'unauthenticated'])(
    'does not retry terminal code %s',
    (code) => {
      expect(shouldRetryApiQuery(0, { code })).toBe(false);
    },
  );

  it('retries an unexpected error while respecting the ceiling', () => {
    expect(shouldRetryApiQuery(0, new Error('network failed'))).toBe(true);
    expect(shouldRetryApiQuery(3, new Error('network failed'))).toBe(false);
  });
});

describe('shouldThrowSettledQueryError', () => {
  const error = new Error('refetch failed');

  it('surfaces a settled refetch error even when cached data remains', () => {
    expect(shouldThrowSettledQueryError(error, false)).toBe(true);
  });

  it('keeps cached data visible while a retry is still fetching', () => {
    expect(shouldThrowSettledQueryError(error, true)).toBe(false);
  });

  it('does not throw without an error', () => {
    expect(shouldThrowSettledQueryError(null, false)).toBe(false);
  });
});
