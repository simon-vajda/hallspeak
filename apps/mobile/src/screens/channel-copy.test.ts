import { describe, expect, it } from '@jest/globals';
import {
  ALL_CHANNEL_COPY,
  channelCopy,
  showListenRings,
  targetLabel,
  UNKNOWN_BADGE,
} from './channel-copy';

/**
 * The rule R31 states, expressed as data. A phrase reaching this list means the screen would
 * be telling a listener that audio is moving when no consumer is open.
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
  'not available',
];

const LIVE_AND_FLOWING = {
  live: true,
  muted: false,
  holding: false,
  linkConnected: true,
  isPlaying: true,
};

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

  it('enumerates something to check', () => {
    expect(ALL_CHANNEL_COPY.length).toBeGreaterThan(10);
  });

  it('withholds both labels for a reading nobody has taken', () => {
    expect(channelCopy('unknown').badge).toBe(null);
    expect(channelCopy('unknown').accessibleBadge).toBe(UNKNOWN_BADGE);
  });

  it('separates the states the socket now supplies', () => {
    expect(channelCopy(LIVE_AND_FLOWING).badge).toBe('On air');
    expect(channelCopy({ ...LIVE_AND_FLOWING, muted: true }).badge).toBe('On air · muted');
    expect(channelCopy({ ...LIVE_AND_FLOWING, live: false, holding: true }).badge).toBe(
      'Speaker dropped off',
    );
  });

  it('reports muted for a paused producer, and offline whenever the link is down', () => {
    expect(channelCopy({ ...LIVE_AND_FLOWING, muted: true }).badge).toBe('On air · muted');
    expect(channelCopy({ ...LIVE_AND_FLOWING, muted: true, linkConnected: false }).badge).toBe(
      'Offline',
    );
    expect(channelCopy({ ...LIVE_AND_FLOWING, linkConnected: false }).badge).toBe('Offline');
  });

  it('names no broadcast state in the note for a link that is down', () => {
    const note = channelCopy({ ...LIVE_AND_FLOWING, linkConnected: false }).note ?? '';

    for (const word of ['on air', 'muted', 'broadcasting', 'interpreter']) {
      expect(`${word}: ${note.toLowerCase().includes(word)}`).toBe(`${word}: false`);
    }
  });

  it('says audio resumes by itself while holding, and claims none is arriving', () => {
    const note = channelCopy({ ...LIVE_AND_FLOWING, live: false, holding: true }).note;

    expect(note).toContain('resumes by itself');
  });

  it('gives the target the word for the state rather than for the press', () => {
    expect(targetLabel('ready')).toBe('Listen');
    expect(targetLabel('unavailable')).toBe('Listen');
    expect(targetLabel('playing')).toBe('Stop listening');
    expect(targetLabel('holding')).toBe('Holding');
  });

  it('stops listen rings while the interpreter is muted', () => {
    expect(showListenRings(true, false)).toBe(true);
    expect(showListenRings(true, null)).toBe(true);
    expect(showListenRings(true, true)).toBe(false);
    expect(showListenRings(false, false)).toBe(false);
  });
});
