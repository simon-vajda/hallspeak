import { describe, expect, it } from '@jest/globals';
import { ALL_AUDIO_SHEET_COPY, DEFAULT_OUTPUTS, selectOutput, volumeLabel } from './audio-sheet';

describe('volumeLabel', () => {
  it('formats the ends and the middle of the range', () => {
    expect(volumeLabel(0, false)).toBe('0%');
    expect(volumeLabel(80, false)).toBe('80%');
    expect(volumeLabel(100, false)).toBe('100%');
  });

  it('reads muted as muted rather than as zero per cent', () => {
    expect(volumeLabel(80, true)).toBe('Muted');
    expect(volumeLabel(0, true)).toBe('Muted');
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
