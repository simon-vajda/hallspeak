import { describe, expect, it } from '@jest/globals';
import { redirectSystemPath } from '../../app/+native-intent';

const wrapped = (url: string) => `https://open.hallspeak.app/?url=${encodeURIComponent(url)}`;

describe('redirectSystemPath', () => {
  it.each([true, false])('opens the channel on initial=%s', (initial) => {
    expect(
      redirectSystemPath({
        path: wrapped('https://church.example:8443/events/481209/espanol'),
        initial,
      }),
    ).toBe('/events/church.example:8443/481209/espanol');
  });

  it.each([true, false])(
    'opens the speaker-link sheet, not the channel, on initial=%s',
    (initial) => {
      expect(
        redirectSystemPath({
          path: wrapped('https://church.example/events/481209/espanol?speaker_code=secret'),
          initial,
        }),
      ).toBe('/speaker-link?server=church.example&eventPin=481209&channel=espanol&code=secret');
    },
  );

  it('keeps a port through the speaker-link sheet path', () => {
    expect(
      redirectSystemPath({
        path: wrapped('https://church.example:8443/events/481209/espanol?speaker_code=secret'),
        initial: false,
      }),
    ).toBe(
      '/speaker-link?server=church.example%3A8443&eventPin=481209&channel=espanol&code=secret',
    );
  });

  it('opens an event when a speaker code arrives without a channel', () => {
    expect(
      redirectSystemPath({
        path: wrapped('https://church.example/events/481209?speaker_code=secret'),
        initial: true,
      }),
    ).toBe('/events/church.example/481209');
  });

  it('handles a relative wrapper path', () => {
    expect(
      redirectSystemPath({
        path: '/?url=https%3A%2F%2Fchurch.example%2Fevents%2F481209',
        initial: false,
      }),
    ).toBe('/events/church.example/481209');
  });

  it('opens an event without a channel', () => {
    expect(
      redirectSystemPath({ path: wrapped('https://church.example/events/481209'), initial: true }),
    ).toBe('/events/church.example/481209');
  });

  it.each([
    'broken',
    'https://open.hallspeak.app/',
    'https://open.hallspeak.app/?url=%E0%A4%A',
    'https://foreign.example/?url=https://church.example/events/481209',
    wrapped('https://example.com/news'),
    wrapped('http://church.example/events/481209'),
    wrapped('https://church.example/events/123/espanol'),
    wrapped('https://church.example/events/481209/bad%20slug'),
    wrapped('https://user:password@church.example/events/481209'),
  ])('falls back to Home for %s', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe('/');
  });

  it.each([
    '/',
    '/events/church.example/481209',
    'hallspeak://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081',
  ])('preserves existing app path %s', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });
});
