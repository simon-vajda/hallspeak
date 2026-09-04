import { describe, expect, it } from '@jest/globals';
import { parseListenerLink } from '../src/venues/link';

describe('parseListenerLink', () => {
  it('yields the host and PIN of a full listener URL, dropping the scheme', () => {
    expect(parseListenerLink('https://linguacast.example.com/events/834912')).toEqual({
      ok: true,
      venue: { host: 'linguacast.example.com', pin: '834912' },
    });
  });

  it('accepts a channel URL and takes the event PIN from it', () => {
    expect(parseListenerLink('https://linguacast.example.com/events/834912/english')).toEqual({
      ok: true,
      venue: { host: 'linguacast.example.com', pin: '834912' },
    });
  });

  it('ignores a trailing slash, a query string and a fragment', () => {
    expect(parseListenerLink('  https://host.example/events/834912/?x=1#y  ')).toEqual({
      ok: true,
      venue: { host: 'host.example', pin: '834912' },
    });
  });

  it('keeps a non-default port and lowercases the host', () => {
    expect(parseListenerLink('https://Host.Example:8443/events/834912')).toEqual({
      ok: true,
      venue: { host: 'host.example:8443', pin: '834912' },
    });
  });

  it('refuses an http URL distinctly from an unparseable string', () => {
    expect(parseListenerLink('http://host.example/events/834912')).toEqual({
      ok: false,
      reason: 'insecure_scheme',
    });
    expect(parseListenerLink('not a link at all')).toEqual({ ok: false, reason: 'not_a_link' });
  });

  it('refuses a URL carrying no PIN', () => {
    expect(parseListenerLink('https://host.example/')).toEqual({
      ok: false,
      reason: 'missing_pin',
    });
    expect(parseListenerLink('https://host.example/events')).toEqual({
      ok: false,
      reason: 'missing_pin',
    });
  });

  it('refuses a PIN that fails the shared pattern', () => {
    expect(parseListenerLink('https://host.example/events/83a912')).toEqual({
      ok: false,
      reason: 'invalid_pin',
    });
    expect(parseListenerLink('https://host.example/events/8349')).toEqual({
      ok: false,
      reason: 'invalid_pin',
    });
  });

  it('refuses an empty string rather than throwing', () => {
    expect(parseListenerLink('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseListenerLink('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses a URL carrying userinfo', () => {
    expect(parseListenerLink('https://someone@host.example/events/834912')).toEqual({
      ok: false,
      reason: 'not_a_link',
    });
  });
});
