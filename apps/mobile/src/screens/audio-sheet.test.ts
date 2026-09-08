import { describe, expect, it } from '@jest/globals';
import { ALL_AUDIO_SHEET_COPY, OUTPUT_NOTE } from './audio-sheet';

describe('audio sheet copy', () => {
  it('never claims audio is playing', () => {
    for (const line of ALL_AUDIO_SHEET_COPY) {
      const lower = line.toLowerCase();

      for (const claim of [
        'is playing',
        'now playing',
        'you are hearing',
        'listening now',
        'not connected',
        'in this version',
      ]) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });

  it('no longer promises a placeholder list of outputs', () => {
    for (const line of ALL_AUDIO_SHEET_COPY) {
      expect(`"${line}" phone speaker: ${line.includes('Phone speaker')}`).toBe(
        `"${line}" phone speaker: false`,
      );
    }
  });

  it('says the chooser belongs to the phone rather than to this sheet', () => {
    expect(OUTPUT_NOTE).toContain('own audio chooser');
  });
});
