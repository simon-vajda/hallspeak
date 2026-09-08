/** The states React Native's AppState reports. `unknown` is its own documented value. */
export type AppStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/**
 * Whether returning to the foreground should reopen the connection by hand.
 *
 * Socket.IO reconnects on its own from a transport failure it saw, but an operating system
 * that suspended the process saw nothing: the socket comes back believing it is connected
 * until a ping eventually fails, which is a minute of a channel that cannot change state.
 * Only a disconnected socket is reopened — reconnecting a live one would drop audio to
 * recover a connection that never went away.
 */
export function shouldReconnectOnForeground(input: {
  previous: AppStatus;
  next: AppStatus;
  connected: boolean;
}): boolean {
  return input.next === 'active' && input.previous !== 'active' && !input.connected;
}
