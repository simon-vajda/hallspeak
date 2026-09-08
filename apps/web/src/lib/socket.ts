import { createSocket, type SocketAuth, type SocketClient } from '@linguacast/client-core/socket';
import { CLIENT_VERSION } from '@/version';

/**
 * Binds the portable factory to this build's version. One socket per page, not a module
 * singleton: the handshake carries the event's PIN, so a singleton could not serve two events
 * and would be rejected outright on the home page, which has no PIN.
 */
export function connectSocket(auth: SocketAuth): SocketClient {
  const socket = createSocket({ clientVersion: CLIENT_VERSION, auth });
  socket.connect();
  return socket;
}
