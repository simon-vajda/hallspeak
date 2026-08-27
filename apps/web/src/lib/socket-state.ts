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
