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

  it('reports a speaker code on a channel link without changing its destination', () => {
    const withCode = parseListenerLink(
      'https://a.example/events/834912/magyar?speaker_code=abc123',
    );

    expect(withCode).toEqual({
      ok: true,
      destination: destination('https://a.example/events/834912/magyar'),
      speakerCode: 'abc123',
    });
  });

  it('reads a speaker code beside other parameters, decoding it once', () => {
    const code = (input: string) => {
      const result = parseListenerLink(input);
      return result.ok ? result.speakerCode : undefined;
    };

    expect(code('https://a.example/events/834912/magyar?utm_source=qr&speaker_code=a%2Bb')).toBe(
      'a+b',
    );
    expect(code('https://a.example/events/834912/magyar?speaker_code=abc#top')).toBe('abc');
  });

  it('treats an empty speaker code, or one on an event link, as a listener link', () => {
    const code = (input: string) => {
      const result = parseListenerLink(input);
      return result.ok ? result.speakerCode : undefined;
    };

    expect(code('https://a.example/events/834912/magyar?speaker_code=')).toBe(null);
    expect(code('https://a.example/events/834912?speaker_code=abc123')).toBe(null);
    expect(code('https://a.example/events/834912/magyar')).toBe(null);
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
