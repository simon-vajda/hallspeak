import {
  ChannelJoinPayload,
  ChannelJoinResponse,
  ChannelLeavePayload,
  ChannelStatus,
  PingPayload,
  PingResponse,
} from '../schemas/socket';
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

  /**
   * Moves the socket into a channel room, in addition to the event room it joined at
   * the handshake — the two are nested, not alternatives. Acked, because a slug that
   * belongs to another event or to a disabled channel must be a visible rejection.
   */
  'channel:join': event({ payload: ChannelJoinPayload, response: ChannelJoinResponse }),

  /** On navigating back to the selector. Fire-and-forget: a failed leave means nothing. */
  'channel:leave': event({ payload: ChannelLeavePayload }),
} as const;

/** Server-initiated events. `as const`: see above. */
export const serverToClient = {
  /**
   * Broadcast to the EVENT room, not the channel room, so the selector and every
   * channel page update together.
   */
  'channel:status': event({ payload: ChannelStatus }),
} as const;
