import { authorizeHandshake, type SocketAuth } from '../core/access';
import { notifications } from '../core/notifications';
import { presence } from '../core/presence';
import { db } from '../db';

/**
 * Structural rather than a real Socket so the gate stays testable with plain objects; a
 * real Socket is assignable to this, so io.use() still accepts the function.
 */
export interface GateSocket {
  id: string;
  handshake: { auth: unknown };
  data: SocketAuth;
}

/**
 * The Error message reaches the client as `connect_error`'s Error.message, which is how
 * 'channel_busy' and 'client_too_old' become distinct client-side states. Unlike a
 * per-packet failure, next(err) is right here: there is no ack to strand.
 */
export function handshakeGate(socket: GateSocket, next: (err?: Error) => void): void {
  const result = authorizeHandshake(db, presence, socket.handshake.auth, socket.id);
  if (!result.ok) {
    next(new Error(result.error));
    return;
  }
  socket.data = result.data;

  // Published rather than disconnected here, so a takeover ends up on the same tested path
  // as worker death and admin revocation instead of being a second way to close a socket.
  if (result.displacedSocketId !== null) {
    notifications.publish({
      type: 'peer-evicted',
      socketId: result.displacedSocketId,
      reason: 'claim_taken_over',
    });
  }

  next();
}
