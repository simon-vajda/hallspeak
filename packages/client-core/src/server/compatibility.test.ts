import { describe, expect, it } from 'vitest';
import {
  assessServerCompatibility,
  hasServerCapability,
  MIN_SERVER_VERSION,
  SERVER_CAPABILITIES,
} from './compatibility';

const info = (serverVersion: string, minMobileVersion = '0.1.0') => ({
  serverVersion,
  minMobileVersion,
});

describe('assessServerCompatibility', () => {
  it('accepts supported 0.x servers and the minimum mobile release', () => {
    expect(assessServerCompatibility(info('0.4.0'), '0.1.0')).toBe('supported');
    expect(assessServerCompatibility(info('0.99.0'), '2.0.0')).toBe('supported');
  });

  it('separates old mobile, old server, and newer unsupported server', () => {
    expect(assessServerCompatibility(info('0.4.0', '0.2.0'), '0.1.0')).toBe('mobile-too-old');
    expect(assessServerCompatibility(info('0.3.9'), '0.1.0')).toBe('server-too-old');
    expect(assessServerCompatibility(info('1.0.0'), '0.1.0')).toBe('server-too-new');
  });

  it('rejects malformed values instead of guessing', () => {
    expect(assessServerCompatibility(info('edge'), '0.1.0')).toBe('invalid-version');
    expect(assessServerCompatibility(info('0.4.0'), '0.1.0-rc.1')).toBe('invalid-version');
  });

  it('reports the mobile floor ahead of any verdict about the server', () => {
    expect(assessServerCompatibility(info('0.3.0', '9.0.0'), '0.1.0')).toBe('mobile-too-old');
    expect(assessServerCompatibility(info('9.0.0', '9.0.0'), '0.1.0')).toBe('mobile-too-old');
  });

  it('applies the minimum server inside a supported major, not the capability map', () => {
    expect(assessServerCompatibility(info(MIN_SERVER_VERSION), '0.1.0')).toBe('supported');
    expect(assessServerCompatibility(info('0.0.1'), '0.1.0')).toBe('server-too-old');
  });
});

describe('hasServerCapability', () => {
  it('uses one threshold map for feature selection', () => {
    expect(hasServerCapability('0.3.9', 'mobileListener')).toBe(false);
    expect(hasServerCapability('0.4.0', 'mobileListener')).toBe(true);
  });

  it('is separate from the floor, so a later capability cannot raise it', () => {
    for (const threshold of Object.values(SERVER_CAPABILITIES)) {
      expect(typeof threshold).toBe('string');
    }
    expect(assessServerCompatibility(info('0.4.0'), '0.1.0')).toBe('supported');
  });
});
