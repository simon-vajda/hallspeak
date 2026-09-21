import { describe, expect, it } from '@jest/globals';
import { displayHost, isListenerHost } from './host';

describe('displayHost', () => {
  it('strips the scheme and any path', () => {
    expect(displayHost('https://stpauls.hallspeak.app/events/834912')).toBe(
      'stpauls.hallspeak.app',
    );
  });

  it('preserves a port', () => {
    expect(displayHost('https://example.com:8443/events/834912')).toBe('example.com:8443');
  });

  it('leaves a bare host alone', () => {
    expect(displayHost('example.com')).toBe('example.com');
  });
});

describe('isListenerHost', () => {
  it('accepts a domain with or without a port', () => {
    expect(isListenerHost('a.example')).toBe(true);
    expect(isListenerHost('a.example:8443')).toBe(true);
  });

  it('rejects anything a path segment could not carry', () => {
    expect(isListenerHost('a.example/events')).toBe(false);
    expect(isListenerHost('user@a.example')).toBe(false);
    expect(isListenerHost('')).toBe(false);
  });
});
