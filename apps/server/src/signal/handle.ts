import type { Ack } from '@linguacast/contract/socket';
import { AppError, toProblem } from '../lib/problem';

/**
 * Deliberately below the client's ackTimeout of 10s. A wedged handler then produces a
 * real `{ ok: false, code: 'timeout' }` at the client instead of a client-side timeout
 * of unknown origin, and the server logs which event hung. Raising this above the
 * client's ackTimeout silently gives that back.
 */
export const HANDLER_TIMEOUT_MS = 8_000;

function withTimeout<T>(work: Promise<T> | T, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error(`Handler for "${event}" exceeded ${HANDLER_TIMEOUT_MS}ms.`);
      reject(new AppError('timeout', `Handler for "${event}" timed out.`));
    }, HANDLER_TIMEOUT_MS);

    Promise.resolve(work)
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer);
      });
  });
}

/**
 * Wraps a handler into the listener shape the contract's derived event map expects:
 *
 *   socket.on('ping', handle('ping', () => ({ serverTime: Date.now() })));
 *
 * `payload` is inferred from the contract with no annotation, and the return value is
 * checked against the event's response schema.
 *
 * The event name is passed explicitly because the listener cannot recover it from
 * socket.on — without it a hung handler logs an anonymous timeout.
 *
 * Errors are shaped by the same toProblem() the HTTP layer uses, which is why
 * lib/problem.ts is kept transport-agnostic: AppError codes survive to the client,
 * anything else becomes internal_error with the original logged.
 *
 * `ack` is optional so the same wrapper serves fire-and-forget events.
 */
export function handle<P, R>(event: string, fn: (payload: P) => Promise<R> | R) {
  return async (payload: P, ack?: (res: Ack<R>) => void): Promise<void> => {
    try {
      ack?.({ ok: true, data: await withTimeout(fn(payload), event) });
    } catch (err) {
      ack?.({ ok: false, error: toProblem(err) });
    }
  };
}
