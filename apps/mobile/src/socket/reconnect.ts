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

/**
 * Whether the listening session's heartbeat should reopen the connection.
 *
 * Socket.IO schedules its own reconnection with a JavaScript timer, which Android stops
 * servicing while the app is not visible — so a link dropped by a network change behind a
 * locked screen is never retried until the guest opens the app. The heartbeat is a clock the
 * platform keeps, and a disconnected socket is the whole condition: `connect()` on a socket
 * already trying again is a no-op, and one that never went away is left alone for the same
 * reason the foreground check leaves it alone.
 */
export function shouldReconnectOnTick(input: { connected: boolean }): boolean {
  return !input.connected;
}
