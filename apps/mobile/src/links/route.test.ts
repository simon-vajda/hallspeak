import { describe, expect, it } from '@jest/globals';
import { buildChannelPath, buildEventPath, readChannelParams, readEventParams } from './route';

describe('route builders', () => {
  it('builds an event path for a plain host', () => {
    expect(buildEventPath('linguacast.app', '834912')).toBe('/events/linguacast.app/834912');
  });

  it('builds an event path for a host carrying a port', () => {
    expect(buildEventPath('example.com:8443', '834912')).toBe('/events/example.com:8443/834912');
  });

  it('builds an event path for a host with several dots', () => {
    expect(buildEventPath('tolmacs.varosmajor.hu', '834912')).toBe(
      '/events/tolmacs.varosmajor.hu/834912',
    );
  });

  it('builds a channel path, hyphenated slug included', () => {
    expect(buildChannelPath('a.example', '834912', 'magyar-jelnyelv')).toBe(
      '/events/a.example/834912/magyar-jelnyelv',
    );
  });
});

describe('readEventParams', () => {
  it('round-trips every host the builder can produce', () => {
    for (const host of ['a.example', 'tolmacs.varosmajor.hu', 'example.com:8443']) {
      const segment = buildEventPath(host, '834912').split('/')[2] ?? '';

      expect(readEventParams(segment, '834912')).toEqual({ host, pin: '834912' });
    }
  });

  it('takes the first value when the router hands back a repeated parameter', () => {
    expect(readEventParams(['a.example', 'b.example'], '834912')).toEqual({
      host: 'a.example',
      pin: '834912',
    });
  });

  it('lower-cases the host so one event cannot hold two cache keys', () => {
    expect(readEventParams('A.Example', '834912')).toEqual({ host: 'a.example', pin: '834912' });
  });

  it('refuses a missing parameter rather than throwing', () => {
    expect(readEventParams(undefined, undefined)).toBeNull();
  });

  // The app registers a URL scheme, so a route reached from outside it is refused here or
  // nowhere: `apiBaseUrl` interpolates the host straight into an origin.
  it('refuses a host the link parser would have refused', () => {
    expect(readEventParams('evil.example/path', '834912')).toBeNull();
    expect(readEventParams('user@evil.example', '834912')).toBeNull();
    expect(readEventParams('', '834912')).toBeNull();
  });

  it('refuses a PIN that is not one', () => {
    expect(readEventParams('a.example', '83491')).toBeNull();
    expect(readEventParams('a.example', '83491a')).toBeNull();
  });
});

describe('readChannelParams', () => {
  it('round-trips a path the builder produced', () => {
    const segments = buildChannelPath('a.example', '834912', 'magyar-jelnyelv').split('/');

    expect(readChannelParams(segments[2], segments[3], segments[4])).toEqual({
      host: 'a.example',
      pin: '834912',
      slug: 'magyar-jelnyelv',
    });
  });

  it('refuses a slug that is not one, and inherits the event refusals', () => {
    expect(readChannelParams('a.example', '834912', 'Magyar Jelnyelv')).toBeNull();
    expect(readChannelParams('a.example', '834912', undefined)).toBeNull();
    expect(readChannelParams('evil.example/path', '834912', 'magyar')).toBeNull();
  });
});
