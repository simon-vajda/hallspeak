import { describe, expect, it } from '@jest/globals';
import { allShareCopy, SHARE_COPY, shareQrLabel } from './share-copy';

/**
 * The listener-copy rule, plus "on air" and "listening": the sheet shares an event, and nothing
 * on it has a reading of whether any channel is broadcasting or how many people hear it.
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
  'listeners',
  'not available',
];

describe('share copy', () => {
  it('never claims audio is moving, a channel is on air, or anyone is listening', () => {
    for (const line of allShareCopy('https://church.example/events/123456')) {
      const lower = line.toLowerCase();

      for (const claim of FORBIDDEN) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });

  it('enumerates something to check', () => {
    expect(allShareCopy('https://church.example/events/123456').length).toBeGreaterThan(5);
  });

  it('names the menu items the web header names', () => {
    expect(SHARE_COPY.menuShare).toBe('Share event');
    expect(SHARE_COPY.menuLabel).toBe('More options');
    expect(SHARE_COPY.title).toBe('Share event');
  });

  it('names the link the code opens', () => {
    expect(shareQrLabel('https://church.example/events/123456')).toContain(
      'https://church.example/events/123456',
    );
  });
});
