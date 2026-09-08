import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_VOLUME,
  DEFAULT_VOLUME_STATE,
  isSilent,
  parseStoredVolume,
  serializeVolume,
  setVolume,
  toggleMute,
  trackGain,
  volumeLabel,
} from './volume';

describe('trackGain', () => {
  it('maps the ends of the slider onto silence and unity', () => {
    expect(trackGain(0)).toBe(0);
    expect(trackGain(100)).toBe(1);
  });

  it('is monotonic in between, and never exceeds unity', () => {
    let previous = -1;

    for (let percent = 0; percent <= 100; percent += 5) {
      const gain = trackGain(percent);

      expect(gain).toBeGreaterThan(previous);
      expect(gain).toBeLessThanOrEqual(1);
      previous = gain;
    }
  });

  it('clamps a value from outside the slider range', () => {
    expect(trackGain(400)).toBe(1);
    expect(trackGain(-20)).toBe(0);
  });
});

describe('mute', () => {
  it('returns to where it came from', () => {
    const muted = toggleMute(setVolume(DEFAULT_VOLUME_STATE, 40));

    expect(isSilent(muted)).toBe(true);
    expect(toggleMute(muted).volume).toBe(40);
  });

  it('does not restore a stale value after the slider itself reached zero', () => {
    const dragged = setVolume(setVolume(DEFAULT_VOLUME_STATE, 40), 0);

    expect(isSilent(dragged)).toBe(true);
    expect(setVolume(dragged, 15).volume).toBe(15);
    expect(toggleMute(dragged).volume).toBe(40);
  });

  it('says muted rather than nought per cent', () => {
    expect(volumeLabel({ volume: 0, lastAudible: 40 })).toBe('Muted');
    expect(volumeLabel({ volume: 40, lastAudible: 40 })).toBe('40%');
  });
});

describe('storage', () => {
  it('defaults a missing key', () => {
    expect(parseStoredVolume(null)).toEqual(DEFAULT_VOLUME_STATE);
  });

  it('defaults a value outside the range and a non-numeric one', () => {
    expect(parseStoredVolume('400').volume).toBe(100);
    expect(parseStoredVolume('-20').volume).toBe(0);
    expect(parseStoredVolume('"loud"').volume).toBe(DEFAULT_VOLUME);
    expect(parseStoredVolume('not json').volume).toBe(DEFAULT_VOLUME);
  });

  it('reads back what a previous session wrote', () => {
    const stored = serializeVolume(setVolume(DEFAULT_VOLUME_STATE, 40));

    expect(parseStoredVolume(stored).volume).toBe(40);
  });

  it('keeps a stored silence rather than reviving the default', () => {
    const stored = serializeVolume(toggleMute(DEFAULT_VOLUME_STATE));

    expect(isSilent(parseStoredVolume(stored))).toBe(true);
  });
});
