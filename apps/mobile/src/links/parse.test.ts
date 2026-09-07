import { describe, expect, it } from '@jest/globals';
import { parseListenerLink } from './parse';

const destination = (input: string) => {
  const result = parseListenerLink(input);
  return result.ok ? result.destination : null;
};

const reason = (input: string) => {
  const result = parseListenerLink(input);
  return result.ok ? null : result.reason;
};

describe('parseListenerLink', () => {
  it('reads an event URL', () => {
    expect(destination('https://stpauls.linguacast.app/events/834912')).toEqual({
      host: 'stpauls.linguacast.app',
      pin: '834912',
      slug: null,
    });
  });

  it('reads a channel URL', () => {
    expect(destination('https://stpauls.linguacast.app/events/834912/magyar')).toEqual({
      host: 'stpauls.linguacast.app',
      pin: '834912',
      slug: 'magyar',
    });
  });

  it('keeps a port, which names a different server', () => {
    expect(destination('https://example.com:8443/events/834912')?.host).toBe('example.com:8443');
  });

  it('ignores a speaker code rather than honouring it', () => {
    const withCode = destination('https://a.example/events/834912/magyar?speaker_code=abc123');

    expect(withCode).toEqual(destination('https://a.example/events/834912/magyar'));
  });

  it('accepts a trailing slash and an unknown query string', () => {
    expect(destination('https://a.example/events/834912/')?.pin).toBe('834912');
    expect(destination('https://a.example/events/834912?utm_source=qr')?.slug).toBe(null);
  });

  it('accepts a hyphenated slug, which the contract permits', () => {
    expect(destination('https://a.example/events/834912/magyar-jelnyelv')?.slug).toBe(
      'magyar-jelnyelv',
    );
  });

  it('refuses a five-digit PIN', () => {
    expect(reason('https://a.example/events/83491')).toBe('bad-pin');
  });

  it('refuses an illegal slug', () => {
    expect(reason('https://a.example/events/834912/Magyar_2')).toBe('bad-slug');
  });

  it('refuses a path that is not an event', () => {
    expect(reason('https://a.example/admin/events/834912')).toBe('wrong-path');
    expect(reason('https://a.example/events/834912/magyar/extra')).toBe('wrong-path');
  });

  it('refuses an insecure scheme separately from a malformed one', () => {
    expect(reason('http://a.example/events/834912')).toBe('insecure-scheme');
    expect(reason('linguacast.app/events/834912')).toBe('not-a-url');
    expect(reason('')).toBe('not-a-url');
  });

  it('refuses a host it cannot put in a path segment', () => {
    expect(reason('https://user@a.example/events/834912')).toBe('unknown-host');
  });
});
