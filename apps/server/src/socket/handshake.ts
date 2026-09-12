import { authorizeHandshake, type SocketAuth } from '../core/access';
import { handover } from '../core/handover';
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
 * version and speaker-code errors become distinct client-side states. Unlike a per-packet
 * failure, next(err) is right here: there is no ack to strand.
 */
export function handshakeGate(socket: GateSocket, next: (err?: Error) => void): void {
  const result = authorizeHandshake(db, presence, socket.handshake.auth, socket.id);
  if (!result.ok) {
    next(new Error(result.error));
    return;
  }
  const { eventId, speakerChannelId, studioSession } = result.data;
  if (speakerChannelId !== null && studioSession !== null) {
    // In the same tick as the claim's rebind, so the old socket's disconnect, whenever it
    // arrives, no longer names anything this studio is waiting for or was granted.
    handover.rebind({
      eventId,
      channelId: speakerChannelId,
      sessionId: studioSession,
      socketId: socket.id,
    });
  }
  socket.data = result.data;
  next();
}
