import { describe, expect, it } from '@jest/globals';
import { FIXTURE_ELAPSED_LABEL } from '../src/fixtures/elapsed';
import {
  BACK_LABEL,
  CHANNEL_STATES,
  type ChannelCopy,
  channelCopy,
  PENDING_NOTE,
  RETRY_LABEL,
} from '../src/venues/channel-copy';

/**
 * The screen renders no audio and holds no consumer, so a claim that anyone is receiving
 * sound would be false rather than merely premature. Verbs, not phrases: a rewrite that
 * reintroduces the claim will not reuse the sentence it was written in.
 */
const FORBIDDEN = [
  /\bplay(s|ed|ing|back)?\b/i,
  /\bhear(s|d|ing)?\b/i,
  /\blisten(s|ed|ing|er|ers)?\b/i,
  /\bstreaming\b/i,
  /\bcoming through\b/i,
];

function stringsOf(copy: ChannelCopy): string[] {
  return Object.values(copy)
    .flatMap((value) => (typeof value === 'object' ? Object.values(value) : [value]))
    .filter((value): value is string => typeof value === 'string');
}

/** Both arguments are exercised: the elapsed figure is copy the screen renders too. */
const EVERY_COPY = [
  ...CHANNEL_STATES.map((state) => channelCopy(state)),
  ...CHANNEL_STATES.map((state) => channelCopy(state, FIXTURE_ELAPSED_LABEL)),
];

const EVERY_STRING = [
  ...EVERY_COPY.flatMap(stringsOf),
  PENDING_NOTE,
  BACK_LABEL,
  RETRY_LABEL,
  FIXTURE_ELAPSED_LABEL,
];

describe('channel copy', () => {
  it('enumerates a copy set for every state', () => {
    expect(CHANNEL_STATES).toHaveLength(4);
    for (const copy of EVERY_COPY) {
      expect(typeof copy.note).toBe('string');
      expect(copy.note.length).toBeGreaterThan(0);
    }
    expect(EVERY_STRING.length).toBeGreaterThan(CHANNEL_STATES.length);
  });

  it('claims nowhere that anyone is receiving audio', () => {
    for (const value of EVERY_STRING) {
      for (const pattern of FORBIDDEN) {
        expect({ value, matched: pattern.test(value) }).toEqual({ value, matched: false });
      }
    }
  });

  it('reports the listen target inert in every state that offers one', () => {
    for (const copy of EVERY_COPY) {
      expect(copy.target?.enabled ?? false).toBe(false);
    }
    expect(channelCopy('on-air').target).toBeDefined();
    expect(channelCopy('offline').target).toBeDefined();
  });

  it('offers no control on a channel that did not resolve', () => {
    for (const state of ['missing', 'unreachable'] as const) {
      const copy = channelCopy(state);
      expect(copy.target).toBeUndefined();
      expect(copy.actions).toBeUndefined();
      expect(copy.title).toBeTruthy();
    }
  });

  it('carries the badge only while the channel is on air, with no placeholder between', () => {
    expect(channelCopy('on-air').badge).toBe('On air');
    expect(Object.hasOwn(channelCopy('offline'), 'badge')).toBe(false);
    expect(Object.hasOwn(channelCopy('missing'), 'badge')).toBe(false);
  });

  it('names the two thumb-line actions in the design order', () => {
    expect(Object.keys(channelCopy('on-air').actions ?? {})).toEqual(['route', 'report']);
  });

  it('states the elapsed figure only when one is supplied', () => {
    expect(channelCopy('on-air', FIXTURE_ELAPSED_LABEL).note).toContain(FIXTURE_ELAPSED_LABEL);
    expect(channelCopy('on-air').note).not.toContain('interpreter');
  });
});
