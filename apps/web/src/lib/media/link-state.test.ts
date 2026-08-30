import { describe, expect, it } from 'vitest';
import {
  filledBars,
  isLinkUp,
  type LinkStateInput,
  linkLabel,
  resolveLinkState,
} from './link-state';
import { BAR_COUNT, FAIR_LOSS, POOR_LOSS } from './stats';

const connected: LinkStateInput = {
  socketStatus: 'connected',
  hasConnected: true,
  mediaHealth: 'connected',
  stats: null,
  mediaWanted: true,
};

describe('resolveLinkState', () => {
  /**
   * What a transport rebuild depends on. The rebuild drops the transport and waits for the
   * effects that wanted media to open another, and those gate on `isLinkUp` — so a session
   * mid-rebuild has to read as up. `trouble` would deadlock it: the link reads down, nothing
   * re-consumes, and the transport is never replaced.
   */
  it('reads a renegotiating session as up, and a troubled one as down', () => {
    expect(isLinkUp(resolveLinkState({ ...connected, mediaHealth: 'connecting' }))).toBe(true);
    expect(isLinkUp(resolveLinkState({ ...connected, mediaHealth: 'trouble' }))).toBe(false);
  });

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

  it('resolves spent media recovery to lost, and only while media is wanted', () => {
    expect(resolveLinkState({ ...connected, mediaHealth: 'failed' })).toEqual({ kind: 'lost' });
    expect(isLinkUp(resolveLinkState({ ...connected, mediaHealth: 'failed' }))).toBe(false);
    expect(resolveLinkState({ ...connected, mediaHealth: 'failed', mediaWanted: false })).toEqual({
      kind: 'idle',
    });
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

describe('resolveLinkState without a media session', () => {
  it('reports nothing when the socket is up and no audio was asked for', () => {
    // An offline channel, or a guest who has not pressed play: the socket alone is not a link
    // worth reporting, and "Connected" there answers a question nobody asked.
    expect(resolveLinkState({ ...connected, mediaHealth: 'idle', mediaWanted: false })).toEqual({
      kind: 'idle',
    });
  });

  it('still reports a socket that has not connected yet', () => {
    expect(
      resolveLinkState({
        ...connected,
        socketStatus: 'connecting',
        hasConnected: false,
        mediaWanted: false,
      }),
    ).toEqual({ kind: 'connecting' });
  });

  it('still reports a terminal failure, which is worth saying with nothing playing', () => {
    expect(resolveLinkState({ ...connected, socketStatus: 'error', mediaWanted: false })).toEqual({
      kind: 'lost',
    });
  });

  it('returns to reporting once audio is asked for', () => {
    expect(resolveLinkState({ ...connected, mediaHealth: 'idle', mediaWanted: true })).toEqual({
      kind: 'connected',
    });
  });
});

describe('isLinkUp', () => {
  it('counts idle as up, because it is only reachable under a connected socket', () => {
    // The listener badge gates on this: a guest on a live channel who has not pressed play
    // must still read `On air`, not `Offline`.
    expect(isLinkUp({ kind: 'idle' })).toBe(true);
  });

  it('counts connected and flowing as up', () => {
    expect(isLinkUp({ kind: 'connected' })).toBe(true);
    expect(isLinkUp({ kind: 'flowing', grade: 'good' })).toBe(true);
  });

  it('counts every in-progress or terminal state as not up', () => {
    expect(isLinkUp({ kind: 'connecting' })).toBe(false);
    expect(isLinkUp({ kind: 'reconnecting' })).toBe(false);
    expect(isLinkUp({ kind: 'lost' })).toBe(false);
  });
});
