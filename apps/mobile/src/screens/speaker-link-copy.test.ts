import { describe, expect, it } from '@jest/globals';
import { allSpeakerLinkCopy, speakerLinkCopy } from './speaker-link-copy';

/**
 * The listener-copy rule, plus "on air": this sheet is reached before any socket exists, so it
 * has no reading of whether the channel is broadcasting.
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
  'on air',
  'not available',
];

describe('speaker-link copy', () => {
  it('never claims audio is moving or the channel is on air', () => {
    for (const line of allSpeakerLinkCopy('church.example')) {
      const lower = line.toLowerCase();

      for (const claim of FORBIDDEN) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });

  it('enumerates something to check', () => {
    expect(allSpeakerLinkCopy('church.example').length).toBeGreaterThan(5);
  });

  it('names the server the browser will open', () => {
    expect(speakerLinkCopy('church.example:8443').body).toContain('church.example:8443');
  });

  it('never has a place to put the speaker code', () => {
    expect(speakerLinkCopy.length).toBe(1);
  });
});
