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
 * Mediasoup events are deferred until the room lifecycle is designed. `as const` is
 * load-bearing: without it the keys widen to `string` and ./define loses its literal names.
 */
export const clientToServer = {
  ping: event({ payload: PingPayload, response: PingResponse }),

  /**
   * The channel room is nested inside the event room, not an alternative to it.
   * Acked, so a slug on another event or a disabled channel is a visible rejection.
   */
  'channel:join': event({ payload: ChannelJoinPayload, response: ChannelJoinResponse }),

  /** Fire-and-forget: a failed leave means nothing. */
  'channel:leave': event({ payload: ChannelLeavePayload }),
} as const;

export const serverToClient = {
  /** To the event room, not the channel room, so the selector and every channel page agree. */
  'channel:status': event({ payload: ChannelStatus }),
} as const;
