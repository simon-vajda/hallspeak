import { describe, expect, it } from '@jest/globals';
import {
  channelReading,
  channelReadingAccessibleLabel,
  channelReadingLabel,
  eventErrorMessage,
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
});
