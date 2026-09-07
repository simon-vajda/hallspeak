import { describe, expect, it } from '@jest/globals';
import { buildChannelPath, buildEventPath, readHostSegment } from './route';

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

describe('readHostSegment', () => {
  it('round-trips every host the builder can produce', () => {
    for (const host of ['a.example', 'tolmacs.varosmajor.hu', 'example.com:8443']) {
      const segment = buildEventPath(host, '834912').split('/')[2] ?? '';

      expect(readHostSegment(segment)).toBe(host);
    }
  });

  it('yields an empty host rather than throwing on a missing parameter', () => {
    expect(readHostSegment(undefined)).toBe('');
  });
});
