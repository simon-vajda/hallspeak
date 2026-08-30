import { describe, expect, it } from 'vitest';
import { channelBroadcast, eventStatusLabel, formatElapsed, formatPin, plural } from './format';

describe('formatPin', () => {
  it('groups the six digits 3+3', () => {
    expect(formatPin('834912')).toBe('834 912');
  });
});

describe('plural', () => {
  it('drops the s at one', () => {
    expect(plural(1, 'channel')).toBe('1 channel');
  });

  it('keeps the s at zero and above one', () => {
    expect(plural(0, 'channel')).toBe('0 channels');
    expect(plural(2, 'channel')).toBe('2 channels');
  });
});

describe('formatElapsed', () => {
  it('starts at zero', () => {
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('pads the seconds but not the leading minutes', () => {
    expect(formatElapsed(61_000)).toBe('1:01');
    expect(formatElapsed(9_000)).toBe('0:09');
  });

  it('drops sub-second remainders rather than rounding up', () => {
    expect(formatElapsed(59_999)).toBe('0:59');
  });

  it('keeps the MM:SS form up to the last second before the hour', () => {
    expect(formatElapsed(3_599_000)).toBe('59:59');
  });

  it('grows an hour field at the hour, padding the minutes', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });

  it('leaves the hour field unpadded past ten hours', () => {
    expect(formatElapsed(45_296_000)).toBe('12:34:56');
  });

  it('treats a negative span as zero, so a clock skew cannot print -1:-1', () => {
    expect(formatElapsed(-5_000)).toBe('0:00');
  });
});

describe('eventStatusLabel', () => {
  it('reports enablement for a disabled event, whatever is on air', () => {
    expect(eventStatusLabel({ enabled: false, channels: 3, onAir: 2, liveKnown: true }).label).toBe(
      'Disabled',
    );
  });

  it('still reports enablement for a disabled event while the poll is failing', () => {
    const status = eventStatusLabel({ enabled: false, channels: 3, onAir: 0, liveKnown: false });
    expect(status).toEqual({ label: 'Disabled', withheld: false });
  });

  it('reports the empty event rather than nobody being on air', () => {
    expect(eventStatusLabel({ enabled: true, channels: 0, onAir: 0, liveKnown: true }).label).toBe(
      'No channels yet',
    );
  });

  it('reports the empty event ahead of any live reading, poll or no poll', () => {
    expect(eventStatusLabel({ enabled: true, channels: 0, onAir: 0, liveKnown: false })).toEqual({
      label: 'No channels yet',
      withheld: false,
    });
  });

  it('says nobody is on air when every channel is idle', () => {
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 0, liveKnown: true }).label).toBe(
      'Nobody on air',
    );
  });

  it('counts the channels that are on air', () => {
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 1, liveKnown: true }).label).toBe(
      '1 on air',
    );
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 2, liveKnown: true }).label).toBe(
      '2 on air',
    );
  });

  it('withholds instead of printing nobody on air when the poll cannot answer', () => {
    // An empty index and a quiet room look identical, so the dash is the whole message.
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 0, liveKnown: false })).toEqual({
      label: '\u2014',
      withheld: true,
    });
  });

  it('treats an event absent from the live payload as none on air', () => {
    // Absence is zero, not an error: a caller indexes the payload and finds nothing.
    const live = new Map<number, number>();
    expect(
      eventStatusLabel({ enabled: true, channels: 2, onAir: live.get(7) ?? 0, liveKnown: true })
        .label,
    ).toBe('Nobody on air');
  });
});

describe('channelBroadcast', () => {
  it('separates the on-air state from its listener count', () => {
    expect(channelBroadcast({ online: true, listeners: 37 }, true)).toEqual({
      state: 'on-air',
      listeners: 37,
    });
  });

  it('is still on air with nobody listening yet', () => {
    expect(channelBroadcast({ online: true, listeners: 0 }, true)).toEqual({
      state: 'on-air',
      listeners: 0,
    });
  });

  it('reports an idle channel as offline, with no count', () => {
    expect(channelBroadcast({ online: false, listeners: 0 }, true)).toEqual({ state: 'offline' });
  });

  it('reports a channel absent from a healthy payload as offline', () => {
    expect(channelBroadcast(undefined, true)).toEqual({ state: 'offline' });
  });

  it('withholds rather than claiming offline while the poll cannot answer', () => {
    expect(channelBroadcast(undefined, false)).toEqual({ state: 'withheld' });
  });

  it('withholds even where the last payload said the channel was on air', () => {
    // A stale value is indistinguishable from a fresh one, so it is not offered as either.
    expect(channelBroadcast({ online: true, listeners: 37 }, false)).toEqual({ state: 'withheld' });
  });
});
