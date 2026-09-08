import { describe, expect, it } from '@jest/globals';
import { ALL_CHANNEL_COPY, channelCopy } from './channel-copy';

/**
 * The rule R29 states, expressed as data. A phrase reaching this list means the screen would
 * be telling a listener that audio is moving when this run ships none.
 */
const FORBIDDEN = [
  'you are hearing',
  'you are listening',
  'is playing',
  'now playing',
  'audio is playing',
  'listening now',
  'people are listening',
  'has been on air for',
  'updates on its own',
  'updating',
  'connected to the interpreter',
];

describe('channel copy', () => {
  it('never claims anybody is hearing audio, in any state', () => {
    for (const line of ALL_CHANNEL_COPY) {
      const lower = line.toLowerCase();

      for (const claim of FORBIDDEN) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });

  it('separates the two readings and withholds the third', () => {
    expect(channelCopy('on-air').badge).toBe('On air');
    expect(channelCopy('offline').badge).toBe('Offline');
    expect(channelCopy('unknown').badge).toBe(null);
    expect(channelCopy('unknown').accessibleBadge).toBe('Status unknown');
  });

  it('no longer says listening is unavailable, now that a socket supplies the state', () => {
    for (const line of ALL_CHANNEL_COPY) {
      expect(`"${line}" unavailable: ${line.includes('not available')}`).toBe(
        `"${line}" unavailable: false`,
      );
    }
  });

  it('says nobody is broadcasting without promising to notice a change', () => {
    const note = channelCopy('offline').note;

    expect(note).toContain('Nobody is broadcasting');
    expect(note).toContain('Pull down');
  });
});
