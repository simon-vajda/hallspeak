import { describe, expect, it } from 'vitest';
import { shouldRetryApiQuery } from './query-retry';

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
