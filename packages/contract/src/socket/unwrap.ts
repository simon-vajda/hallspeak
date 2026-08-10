import type { Ack } from './define';

/** An application-level failure carried in an ack envelope, rethrown at the call site. */
export class SignalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SignalError';
  }
}

/**
 * Collapses the ack envelope so call sites read as ordinary async code:
 *
 *   const { serverTime } = unwrap(await socket.emitWithAck('ping', {}));
 *
 * Timeouts and disconnects reject the promise with Socket.IO's own Error; application
 * failures resolve with `{ ok: false }` and throw SignalError here. Both are throws at
 * the call site, distinguishable by type when that matters.
 */
export function unwrap<T>(res: Ack<T>): T {
  if (!res.ok) throw new SignalError(res.error.code, res.error.message);
  return res.data;
}
