import { describe, expect, it } from '@jest/globals';
import {
  channelReading,
  channelReadingAccessibleLabel,
  channelReadingLabel,
  eventErrorMessage,
  eventScreenState,
  NO_CHANNELS_BODY,
} from './event-view';

describe('channelReading', () => {
  it('reports what the fetch returned', () => {
    expect(channelReading(true, true)).toBe('on-air');
    expect(channelReading(false, true)).toBe('offline');
  });

  it('withholds rather than reporting the negative when no reading exists', () => {
    expect(channelReading(false, false)).toBe('unknown');
    expect(channelReading(undefined, true)).toBe('unknown');
  });
});

describe('channelReadingLabel', () => {
  it('prints neither label for a withheld reading', () => {
    expect(channelReadingLabel('unknown')).toBe(null);
    expect(channelReadingAccessibleLabel('unknown')).toBe('Status unknown');
  });

  it('separates the two readings it does have', () => {
    expect(channelReadingLabel('on-air')).toBe('On air');
    expect(channelReadingLabel('offline')).toBe('Offline');
  });
});

describe('eventErrorMessage', () => {
  it('gives a 404 and a transport failure the same message', () => {
    expect(eventErrorMessage({ code: 'not_found' })).toEqual(
      eventErrorMessage({ code: 'unavailable' }),
    );
  });

  it('names no cause in that message', () => {
    const { title, body } = eventErrorMessage({ code: 'not_found' });

    for (const word of ['disabled', 'certificate', 'offline', 'unknown PIN']) {
      expect(`${word} ${`${title} ${body}`.includes(word)}`).toBe(`${word} false`);
    }
  });

  it('separates a rate limit, which the guest can act on', () => {
    expect(eventErrorMessage({ code: 'rate_limited' }).title).toBe('Too many tries');
  });

  it('offers no pull-down the screen does not have', () => {
    const bodies = [
      eventErrorMessage({ code: 'not_found' }).body,
      eventErrorMessage({ code: 'rate_limited' }).body,
      NO_CHANNELS_BODY,
    ];

    for (const body of bodies) {
      expect(`${body}: ${body.toLowerCase().includes('pull down')}`).toBe(`${body}: false`);
    }
  });
});

describe('eventScreenState', () => {
  const base = { routeValid: true, gate: 'ready', isError: false, hasEvent: false } as const;

  it('loads while the server version is still being checked', () => {
    expect(eventScreenState({ ...base, gate: 'checking' })).toBe('loading');
  });

  it('loads while the event request is in flight', () => {
    expect(eventScreenState(base)).toBe('loading');
  });

  it('is ready once the event has arrived', () => {
    expect(eventScreenState({ ...base, hasEvent: true })).toBe('ready');
  });

  it('reports a failure only once the read settled as failed with nothing to show', () => {
    expect(eventScreenState({ ...base, isError: true })).toBe('error');
  });

  it('keeps showing an event a later refetch failed to refresh', () => {
    expect(eventScreenState({ ...base, isError: true, hasEvent: true })).toBe('ready');
  });

  it('blocks on the version gate even while the event would still be loading', () => {
    expect(eventScreenState({ ...base, gate: 'blocked' })).toBe('blocked');
  });

  it('refuses an address that is not an event ahead of everything else', () => {
    expect(
      eventScreenState({ routeValid: false, gate: 'blocked', isError: true, hasEvent: true }),
    ).toBe('bad-route');
  });
});
