import { describe, expect, it } from 'vitest';
import { channelLiveLabel, eventStatusLabel, formatElapsed, formatPin, plural } from './format';

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
    expect(eventStatusLabel({ enabled: false, channels: 3, onAir: 2 })).toBe('Disabled');
  });

  it('reports the empty event rather than nobody being on air', () => {
    expect(eventStatusLabel({ enabled: true, channels: 0, onAir: 0 })).toBe('No channels yet');
  });

  it('says nobody is on air when every channel is idle', () => {
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 0 })).toBe('Nobody on air');
  });

  it('counts the channels that are on air', () => {
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 1 })).toBe('1 on air');
    expect(eventStatusLabel({ enabled: true, channels: 3, onAir: 2 })).toBe('2 on air');
  });

  it('treats an event absent from the live payload as none on air', () => {
    // Absence is zero, not an error: a caller indexes the payload and finds nothing.
    const live = new Map<number, number>();
    expect(eventStatusLabel({ enabled: true, channels: 2, onAir: live.get(7) ?? 0 })).toBe(
      'Nobody on air',
    );
  });
});

describe('channelLiveLabel', () => {
  it('counts the listeners of a channel that is on air', () => {
    expect(channelLiveLabel({ online: true, listeners: 37 })).toBe('On air · 37 listening');
  });

  it('reads the same at one, because the participle does not agree', () => {
    expect(channelLiveLabel({ online: true, listeners: 1 })).toBe('On air · 1 listening');
  });

  it('still says on air with nobody listening yet', () => {
    expect(channelLiveLabel({ online: true, listeners: 0 })).toBe('On air · 0 listening');
  });

  it('says nobody is on air for an idle channel', () => {
    expect(channelLiveLabel({ online: false, listeners: 0 })).toBe('Nobody on air');
  });

  it('says nobody is on air for a channel absent from the payload', () => {
    expect(channelLiveLabel(undefined)).toBe('Nobody on air');
  });
});
