import { describe, expect, it } from 'vitest';
import { initialSocketConnectionState, socketConnectionState } from './state';

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
