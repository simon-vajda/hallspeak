import { authorizeHandshake, type SocketAuth } from '../core/access';
import { presence } from '../core/presence';
import { db } from '../db';

/**
 * The shape this gate needs from a Socket. Structural rather than a real Socket so the
 * decision under it stays testable with plain objects — a real Socket is assignable to
 * this, so io.use() still accepts the function.
 */
export interface GateSocket {
  id: string;
  handshake: { auth: unknown };
  data: SocketAuth;
}

/**
 * Connection-time gate, registered with io.use(). The Error message reaches the client
 * as `connect_error`'s Error.message, which is how 'channel_busy' and 'client_too_old'
 * become distinct client-side states.
 *
 * Unlike per-packet failures (see ./validate), rejecting with next(err) IS the idiomatic
 * move here: there is no ack to strand, and Socket.IO's connection-error path exists
 * precisely for this.
 */
export function handshakeGate(socket: GateSocket, next: (err?: Error) => void): void {
  const result = authorizeHandshake(db, presence, socket.handshake.auth, socket.id);
  if (!result.ok) {
    next(new Error(result.error));
    return;
  }
  socket.data = result.data;
  next();
}
