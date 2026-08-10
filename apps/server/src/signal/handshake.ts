import { Handshake } from '@linguacast/contract/schemas';
import { MIN_CLIENT_VERSION } from '../version';

/**
 * Total by construction: Handshake's regex rejects anything that is not x.y.z, so both
 * operands always split into three numbers and no parse can fail here. That is the whole
 * reason the schema is strict about prereleases — it buys a six-line comparison instead
 * of a semver dependency.
 */
export function semverLt(a: string, b: string): boolean {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Connection-time version gate, registered with io.use(). The Error message reaches the
 * client as `connect_error`'s Error.message.
 *
 * Unlike per-packet failures (see ./validate), rejecting with next(err) IS the idiomatic
 * move here: there is no ack to strand, and Socket.IO's connection-error path exists
 * precisely for this.
 *
 * Structurally typed rather than taking a Socket so it is testable with a plain object.
 * A real Socket is assignable to this shape, so io.use() still accepts it.
 */
export function handshakeGate(
  socket: { handshake: { auth: unknown } },
  next: (err?: Error) => void,
): void {
  const parsed = Handshake.safeParse(socket.handshake.auth);
  if (!parsed.success) {
    next(new Error('invalid_handshake'));
    return;
  }
  if (semverLt(parsed.data.clientVersion, MIN_CLIENT_VERSION)) {
    next(new Error('client_too_old'));
    return;
  }
  next();
}
