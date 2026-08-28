import { describe, expect, it } from 'vitest';
import {
  changeAudioVolume,
  createAudioVolumeState,
  DEFAULT_AUDIO_VOLUME,
  mediaElementVolume,
  parseStoredVolume,
  serializeVolume,
  toggleAudioMute,
} from './volume';

describe('stored listener volume', () => {
  it.each([null, '', 'not json', '"70"', 'null', 'false', '{}', '[]'])(
    'defaults invalid stored value %j',
    (raw) => {
      expect(parseStoredVolume(raw)).toBe(DEFAULT_AUDIO_VOLUME);
    },
  );

  it('rounds fractional values and clamps the stored range', () => {
    expect(parseStoredVolume('42.6')).toBe(43);
    expect(parseStoredVolume('-10')).toBe(0);
    expect(parseStoredVolume('140')).toBe(100);
  });

  it('round trips a valid percentage', () => {
    expect(parseStoredVolume(serializeVolume(82))).toBe(82);
  });
});

describe('listener media volume', () => {
  it('maps percentages onto the media-element range', () => {
    expect(mediaElementVolume(0)).toBe(0);
    expect(mediaElementVolume(70)).toBe(0.7);
    expect(mediaElementVolume(100)).toBe(1);
  });
});

describe('listener mute state', () => {
  it('mutes and restores the previous audible level', () => {
    const audible = createAudioVolumeState(64);
    const muted = toggleAudioMute(audible);

    expect(muted).toEqual({ volume: 0, lastAudibleVolume: 64 });
    expect(toggleAudioMute(muted)).toEqual(audible);
  });

  it('restores the default after loading a muted value', () => {
    expect(toggleAudioMute(createAudioVolumeState(0))).toEqual({
      volume: DEFAULT_AUDIO_VOLUME,
      lastAudibleVolume: DEFAULT_AUDIO_VOLUME,
    });
  });

  it('remembers the latest non-zero slider value', () => {
    const muted = changeAudioVolume(createAudioVolumeState(70), 0);
    const raised = changeAudioVolume(muted, 38);

    expect(toggleAudioMute(toggleAudioMute(raised))).toEqual(raised);
  });
});
