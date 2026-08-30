import { describe, expect, it } from 'vitest';
import { channelLiveWarning, eventLiveWarning } from './admin-live-warning';

describe('channelLiveWarning', () => {
  it('warns about a channel that is on air', () => {
    const warning = channelLiveWarning({
      enabled: true,
      broadcast: { state: 'on-air', listeners: 4 },
    });

    expect(warning).toContain('on air');
  });

  it('warns whether or not anybody is listening yet, because the interpreter is still there', () => {
    expect(
      channelLiveWarning({ enabled: true, broadcast: { state: 'on-air', listeners: 0 } }),
    ).toBeDefined();
  });

  it('says nothing about an idle channel', () => {
    expect(channelLiveWarning({ enabled: true, broadcast: { state: 'offline' } })).toBeUndefined();
  });

  it('says nothing while the poll is withheld, rather than guessing either way', () => {
    expect(channelLiveWarning({ enabled: true, broadcast: { state: 'withheld' } })).toBeUndefined();
  });

  it('says nothing about a disabled channel, whose leftover producer has no audience', () => {
    expect(
      channelLiveWarning({ enabled: false, broadcast: { state: 'on-air', listeners: 4 } }),
    ).toBeUndefined();
  });
});

describe('eventLiveWarning', () => {
  it('names the one live channel among several', () => {
    expect(eventLiveWarning({ enabled: true, onAir: 1, liveKnown: true })).toBe(
      '1 channel of this event is on air right now.',
    );
  });

  it('agrees with a plural count', () => {
    expect(eventLiveWarning({ enabled: true, onAir: 3, liveKnown: true })).toBe(
      '3 channels of this event are on air right now.',
    );
  });

  it('says nothing when no channel is on air', () => {
    expect(eventLiveWarning({ enabled: true, onAir: 0, liveKnown: true })).toBeUndefined();
  });

  it('says nothing while the poll is withheld', () => {
    expect(eventLiveWarning({ enabled: true, onAir: 2, liveKnown: false })).toBeUndefined();
  });

  it('says nothing about a disabled event carrying a stale live entry', () => {
    expect(eventLiveWarning({ enabled: false, onAir: 2, liveKnown: true })).toBeUndefined();
  });
});
