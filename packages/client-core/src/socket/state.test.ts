import { describe, expect, it } from 'vitest';
import { anchorHandover, initialSocketConnectionState, socketConnectionState } from './state';

describe('socketConnectionState', () => {
  it('orders a retryable drop before the reconnect attempt and successful recovery', () => {
    const connecting = socketConnectionState(initialSocketConnectionState, { type: 'start' });
    const connected = socketConnectionState(connecting, { type: 'connect' });
    const lost = socketConnectionState(connected, {
      type: 'disconnect',
      reason: 'transport close',
    });
    const retrying = socketConnectionState(lost, { type: 'reconnect-attempt' });
    const recovered = socketConnectionState(retrying, { type: 'connect' });

    expect([connected.status, lost.status, retrying.status, recovered.status]).toEqual([
      'connected',
      'lost',
      'connecting',
      'connected',
    ]);
  });

  it('keeps a failed retry in reconnecting state', () => {
    const connected = socketConnectionState(initialSocketConnectionState, { type: 'connect' });
    const lost = socketConnectionState(connected, {
      type: 'disconnect',
      reason: 'ping timeout',
    });
    const retrying = socketConnectionState(lost, { type: 'reconnect-attempt' });

    expect(
      socketConnectionState(retrying, {
        type: 'connect-error',
        message: 'transport error',
        retryable: true,
      }),
    ).toMatchObject({ status: 'connecting', error: null, hasConnected: true });
  });

  it('reports a non-retryable first handshake refusal as terminal', () => {
    const connecting = socketConnectionState(initialSocketConnectionState, { type: 'start' });

    expect(
      socketConnectionState(connecting, {
        type: 'connect-error',
        message: 'channel_busy',
        retryable: false,
      }),
    ).toEqual({ status: 'error', error: 'channel_busy', hasConnected: false });
  });

  it('keeps a retryable first transport failure connecting', () => {
    const connecting = socketConnectionState(initialSocketConnectionState, { type: 'start' });

    expect(
      socketConnectionState(connecting, {
        type: 'connect-error',
        message: 'transport error',
        retryable: true,
      }),
    ).toEqual({ status: 'connecting', error: null, hasConnected: false });
  });

  it('reports a server disconnect as terminal', () => {
    const connected = socketConnectionState(initialSocketConnectionState, { type: 'connect' });

    expect(
      socketConnectionState(connected, {
        type: 'disconnect',
        reason: 'io server disconnect',
      }),
    ).toEqual({ status: 'error', error: 'session_ended', hasConnected: true });
  });

  it('returns to idle when the socket owner unmounts', () => {
    const connected = socketConnectionState(initialSocketConnectionState, { type: 'connect' });

    expect(socketConnectionState(connected, { type: 'stop' })).toBe(initialSocketConnectionState);
  });
});

describe('anchorHandover', () => {
  const live = {
    slug: 'english',
    holder: 'self',
    role: 'live',
    pending: false,
    remainingMs: null,
    canTakeOver: false,
  } as const;

  it('turns the remaining duration into a deadline on this client clock', () => {
    const anchored = anchorHandover({ ...live, pending: true, remainingMs: 30_000 }, 1_000);

    expect(anchored.expiresAt).toBe(31_000);
  });

  it('carries no deadline when the server names no countdown', () => {
    expect(anchorHandover(live, 1_000).expiresAt).toBeNull();
  });

  it('keeps the server as the authority on whether a takeover is available', () => {
    const waiting = {
      ...live,
      holder: 'other',
      role: 'waiting',
      pending: true,
      remainingMs: 0,
      canTakeOver: false,
    } as const;

    expect(anchorHandover(waiting, 5_000).canTakeOver).toBe(false);
    expect(anchorHandover({ ...waiting, canTakeOver: true }, 5_000).canTakeOver).toBe(true);
  });

  it('keeps the slug, holder, role and pending flag the server sent', () => {
    const anchored = anchorHandover(
      { ...live, holder: 'other', role: 'bystander', pending: true },
      0,
    );

    expect(anchored).toEqual({
      slug: 'english',
      holder: 'other',
      role: 'bystander',
      pending: true,
      canTakeOver: false,
      expiresAt: null,
    });
  });
});
