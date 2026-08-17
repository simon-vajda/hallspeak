import {
  ChannelJoinPayload,
  ChannelJoinResponse,
  ChannelLeavePayload,
  ChannelStatus,
  MediaCapabilitiesPayload,
  MediaCapabilitiesResponse,
  MediaConnectTransportPayload,
  MediaConnectTransportResponse,
  MediaConsumePayload,
  MediaConsumeResponse,
  MediaConsumerPayload,
  MediaConsumerResponse,
  MediaCreateTransportPayload,
  MediaCreateTransportResponse,
  MediaProducePayload,
  MediaProduceResponse,
  MediaProducerPayload,
  MediaProducerResponse,
  MediaReset,
  PingPayload,
  PingResponse,
} from '../schemas/socket';
import { event } from './define';

/**
 * `as const` is load-bearing: without it the keys widen to `string` and ./define loses
 * its literal names.
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

  /** Where every negotiation starts, and restarts from after a reset. */
  'media:capabilities': event({
    payload: MediaCapabilitiesPayload,
    response: MediaCapabilitiesResponse,
  }),

  /** One send and one receive transport per socket; a second in either direction is refused. */
  'media:create-transport': event({
    payload: MediaCreateTransportPayload,
    response: MediaCreateTransportResponse,
  }),
  'media:connect-transport': event({
    payload: MediaConnectTransportPayload,
    response: MediaConnectTransportResponse,
  }),

  'media:produce': event({ payload: MediaProducePayload, response: MediaProduceResponse }),

  /**
   * Mute pauses rather than closes: the channel stays live across it. Every close is
   * acked too — a close that silently fails orphans server state nobody can reach.
   */
  'media:pause-producer': event({ payload: MediaProducerPayload, response: MediaProducerResponse }),
  'media:resume-producer': event({
    payload: MediaProducerPayload,
    response: MediaProducerResponse,
  }),
  'media:close-producer': event({ payload: MediaProducerPayload, response: MediaProducerResponse }),

  /** Consumers are created paused; `media:resume-consumer` is what starts the audio. */
  'media:consume': event({ payload: MediaConsumePayload, response: MediaConsumeResponse }),
  'media:resume-consumer': event({
    payload: MediaConsumerPayload,
    response: MediaConsumerResponse,
  }),
  'media:close-consumer': event({ payload: MediaConsumerPayload, response: MediaConsumerResponse }),
} as const;

export const serverToClient = {
  /**
   * To the event room, not the channel room, so the selector and every channel page agree.
   * This is also the producer-lifecycle event: `online` means an unclosed producer exists,
   * so a guest arms on it and consumes when it turns true.
   */
  'channel:status': event({ payload: ChannelStatus }),

  /** Discard every held media identifier and renegotiate; the socket itself survives. */
  'media:reset': event({ payload: MediaReset }),
} as const;
