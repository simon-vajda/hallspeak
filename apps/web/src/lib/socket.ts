import { createSocket, type SocketAuth, type SocketClient } from '@/socket/client';
import { CLIENT_VERSION } from '@/version';

/**
 * Binds the portable factory to this build's version — socket/ must stay free of it.
 *
 * One socket PER PAGE, not one per app: the handshake carries the event's PIN, so a
 * module-level singleton could not serve two events and would be rejected outright on
 * the home page, which has no PIN at all.
 */
export function connectSocket(auth: SocketAuth): SocketClient {
  const socket = createSocket({ clientVersion: CLIENT_VERSION, auth });
  socket.connect();
  return socket;
}
