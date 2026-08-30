import { describe, expect, it } from 'vitest';
import { filledBars, type LinkStateInput, linkLabel, resolveLinkState } from './link-state';
import { BAR_COUNT, FAIR_LOSS, POOR_LOSS } from './stats';

const connected: LinkStateInput = {
  socketStatus: 'connected',
  hasConnected: true,
  mediaHealth: 'connected',
  stats: null,
};

describe('resolveLinkState', () => {
  it('resolves a terminal socket error to lost regardless of media health', () => {
    expect(
      resolveLinkState({
        ...connected,
        socketStatus: 'error',
        mediaHealth: 'connecting',
        stats: { packetLoss: 0, jitter: 0 },
      }),
    ).toEqual({ kind: 'lost' });
  });

  it('resolves an unconnected first socket to connecting', () => {
    expect(
      resolveLinkState({ ...connected, socketStatus: 'connecting', hasConnected: false }),
    ).toEqual({ kind: 'connecting' });
  });

  it('resolves first-time media setup to connecting under a connected socket', () => {
    expect(
      resolveLinkState({ ...connected, hasConnected: false, mediaHealth: 'connecting' }),
    ).toEqual({ kind: 'connecting' });
  });

  it('resolves a previously connected socket drop to reconnecting', () => {
    expect(resolveLinkState({ ...connected, socketStatus: 'lost' })).toEqual({
      kind: 'reconnecting',
    });
  });

  it('resolves media trouble under a healthy socket to reconnecting', () => {
    expect(resolveLinkState({ ...connected, mediaHealth: 'trouble' })).toEqual({
      kind: 'reconnecting',
    });
  });

  it('resolves two healthy legs with stats to their existing grade', () => {
    expect(resolveLinkState({ ...connected, stats: { packetLoss: FAIR_LOSS, jitter: 0 } })).toEqual(
      { kind: 'flowing', grade: 'fair' },
    );
  });

  it('resolves two healthy legs without stats to connected', () => {
    expect(resolveLinkState(connected)).toEqual({ kind: 'connected' });
  });

  it('does not let held stats claim flowing while the socket reconnects', () => {
    expect(
      resolveLinkState({
        ...connected,
        socketStatus: 'connecting',
        stats: { packetLoss: 0, jitter: 0 },
      }),
    ).toEqual({ kind: 'reconnecting' });
  });
});

describe('link presentation', () => {
  it('fills bars only while flowing', () => {
    expect(filledBars({ kind: 'flowing', grade: 'good' })).toBe(BAR_COUNT);
    expect(filledBars({ kind: 'flowing', grade: 'fair' })).toBe(6);
    expect(filledBars({ kind: 'flowing', grade: 'poor' })).toBe(3);

    for (const state of [
      { kind: 'connecting' },
      { kind: 'reconnecting' },
      { kind: 'connected' },
      { kind: 'lost' },
    ] as const) {
      expect(filledBars(state)).toBe(0);
    }
  });

  it('uses the fixed link vocabulary', () => {
    expect(linkLabel({ kind: 'connecting' })).toBe('Connecting…');
    expect(linkLabel({ kind: 'reconnecting' })).toBe('Reconnecting…');
    expect(linkLabel({ kind: 'connected' })).toBe('Connected');
    expect(linkLabel({ kind: 'flowing', grade: 'good' })).toBe('Good connection');
    expect(linkLabel({ kind: 'flowing', grade: 'fair' })).toBe('A little unsteady');
    expect(linkLabel({ kind: 'flowing', grade: 'poor' })).toBe('Poor connection');
    expect(linkLabel({ kind: 'lost' })).toBe('Connection lost');
  });

  it('keeps poor grading wired to the existing thresholds', () => {
    expect(resolveLinkState({ ...connected, stats: { packetLoss: POOR_LOSS, jitter: 0 } })).toEqual(
      { kind: 'flowing', grade: 'poor' },
    );
  });
});
