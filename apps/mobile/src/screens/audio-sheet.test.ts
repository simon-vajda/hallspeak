import { describe, expect, it } from '@jest/globals';
import {
  ALL_AUDIO_SHEET_COPY,
  DEFAULT_OUTPUTS,
  DEFAULT_VOLUME_STATE,
  isSilent,
  selectOutput,
  setVolume,
  toggleMute,
  volumeLabel,
} from './audio-sheet';

describe('volumeLabel', () => {
  it('formats the range', () => {
    expect(volumeLabel(setVolume(DEFAULT_VOLUME_STATE, 80))).toBe('80%');
    expect(volumeLabel(setVolume(DEFAULT_VOLUME_STATE, 100))).toBe('100%');
  });

  it('reads zero as muted rather than as nought per cent', () => {
    expect(volumeLabel(setVolume(DEFAULT_VOLUME_STATE, 0))).toBe('Muted');
  });
});

describe('mute', () => {
  it('is the same state as a slider dragged to the end', () => {
    expect(isSilent(setVolume(DEFAULT_VOLUME_STATE, 0))).toBe(true);
    expect(isSilent(toggleMute(DEFAULT_VOLUME_STATE))).toBe(true);
  });

  it('returns to where the volume was', () => {
    const muted = toggleMute(setVolume(DEFAULT_VOLUME_STATE, 35));

    expect(toggleMute(muted).volume).toBe(35);
  });

  it('does not adopt zero as the level to come back to', () => {
    const muted = setVolume(DEFAULT_VOLUME_STATE, 0);

    expect(toggleMute(muted).volume).toBe(DEFAULT_VOLUME_STATE.lastAudible);
  });
});

describe('selectOutput', () => {
  it('moves the checkmark and leaves every other row unselected', () => {
    const after = selectOutput(DEFAULT_OUTPUTS, 'headphones');

    expect(after.filter((output) => output.selected).map((output) => output.id)).toEqual([
      'headphones',
    ]);
  });
});

describe('audio sheet copy', () => {
  it('never claims audio is playing', () => {
    for (const line of ALL_AUDIO_SHEET_COPY) {
      const lower = line.toLowerCase();

      for (const claim of ['is playing', 'now playing', 'you are hearing', 'listening now']) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });
});
