import type { HandoverHolder, HandoverRole, HandoverState } from '@hallspeak/contract/socket';

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'lost' | 'error';

export interface SocketConnectionState {
  status: SocketStatus;
  error: string | null;
  /** Distinguishes a failed first handshake from a retry after a working connection. */
  hasConnected: boolean;
}

export const initialSocketConnectionState: SocketConnectionState = {
  status: 'idle',
  error: null,
  hasConnected: false,
};

export type SocketConnectionEvent =
  | { type: 'start' }
  | { type: 'connect' }
  | { type: 'disconnect'; reason: string }
  | { type: 'reconnect-attempt' }
  | { type: 'connect-error'; message: string; retryable: boolean }
  | { type: 'stop' };

/**
 * Keeps retryable connection loss separate from terminal handshake and server refusals.
 * Socket.IO emits `disconnect` before its manager emits `reconnect_attempt`, which gives
 * the public UI the intended "Connection lost", then "Reconnecting" ordering.
 */
export function socketConnectionState(
  state: SocketConnectionState,
  event: SocketConnectionEvent,
): SocketConnectionState {
  switch (event.type) {
    case 'start':
      return { status: 'connecting', error: null, hasConnected: false };
    case 'connect':
      return { status: 'connected', error: null, hasConnected: true };
    case 'disconnect':
      return event.reason === 'io server disconnect'
        ? { ...state, status: 'error', error: 'session_ended' }
        : { ...state, status: 'lost', error: null };
    case 'reconnect-attempt':
      return { ...state, status: 'connecting', error: null };
    case 'connect-error':
      return event.retryable
        ? { ...state, status: 'connecting', error: null }
        : { ...state, status: 'error', error: event.message };
    case 'stop':
      return initialSocketConnectionState;
  }
}

/**
 * A handover snapshot anchored to this client's clock at receipt. The wire carries a
 * remaining duration rather than a deadline, for the same reason report rows carry an age:
 * a client clock minutes off the server's would make an absolute deadline wrong by that
 * offset. `canTakeOver` is copied rather than re-derived from `expiresAt` — the server owns
 * that answer, and a client counting to zero on its own would offer a takeover the server
 * refuses.
 */
export interface AnchoredHandover {
  slug: string;
  holder: HandoverHolder;
  role: HandoverRole;
  pending: boolean;
  canTakeOver: boolean;
  expiresAt: number | null;
  /**
   * When this channel went on air, on this client's clock. The broadcast belongs to the
   * channel rather than to one interpreter, so a studio taking it over continues the clock
   * rather than starting a second one. Null when nobody holds the channel.
   */
  onAirStartedAt: number | null;
}

export function anchorHandover(state: HandoverState, now: number): AnchoredHandover {
  return {
    slug: state.slug,
    holder: state.holder,
    role: state.role,
    pending: state.pending,
    canTakeOver: state.canTakeOver,
    expiresAt: state.remainingMs === null ? null : now + state.remainingMs,
    onAirStartedAt: state.onAirMs === null ? null : now - state.onAirMs,
  };
}
