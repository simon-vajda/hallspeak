import { PingPayload, PingResponse } from '../schemas/signal';
import { event } from './define';

/**
 * Events a client may send. Every mediasoup event is deliberately deferred: their
 * wire shapes depend on a room/transport/producer lifecycle that has not been
 * designed, and guessing at them while also debugging a new transport is how both
 * end up wrong.
 *
 * `as const` is load-bearing and looks removable. Without it every key widens to
 * `string`, the mapped types in ./define lose their literal keys, and autocomplete on
 * event names stops working.
 */
export const clientToServer = {
  /** Liveness probe. Exercises the ack, validation, error and timeout paths. */
  ping: event({ payload: PingPayload, response: PingResponse }),
} as const;

/** Server-initiated events. Empty until mediasoup needs one. `as const`: see above. */
export const serverToClient = {} as const;
