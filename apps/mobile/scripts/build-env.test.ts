import { describe, expect, it } from '@jest/globals';
import { buildEnvContents } from './build-env.mjs';

describe('buildEnvContents', () => {
  it('writes the first seven characters of a full commit hash', () => {
    expect(buildEnvContents('3f9c2a1d0b8e7f6a5c4d3e2f1a0b9c8d7e6f5a4b')).toBe(
      'EXPO_PUBLIC_COMMIT=3f9c2a1\n',
    );
  });

  it('writes nothing when the hash is unset or empty', () => {
    expect(buildEnvContents(undefined)).toBeNull();
    expect(buildEnvContents('')).toBeNull();
  });

  it('uses a hash shorter than seven characters whole', () => {
    expect(buildEnvContents('abc12')).toBe('EXPO_PUBLIC_COMMIT=abc12\n');
  });
});
