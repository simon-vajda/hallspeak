import type { Ack } from './define';

export class SocketError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SocketError';
  }
}

/**
 * Collapses the ack envelope: `unwrap(await socket.emitWithAck('ping', {}))`.
 * Application failures throw SocketError; timeouts reject with Socket.IO's own Error.
 */
export function unwrap<T>(res: Ack<T>): T {
  if (!res.ok) throw new SocketError(res.error.code, res.error.message);
  return res.data;
}
