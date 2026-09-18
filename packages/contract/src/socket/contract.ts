import {
  ChannelJoinPayload,
  ChannelJoinResponse,
  ChannelLeavePayload,
  ChannelListenerHistory,
  ChannelListeners,
  ChannelReportPayload,
  ChannelReportResponse,
  ChannelReports,
  ChannelResolveReportsPayload,
  ChannelResolveReportsResponse,
  ChannelStatus,
  HandoverActionPayload,
  HandoverActionResponse,
  HandoverState,
  MediaCapabilitiesPayload,
  MediaCapabilitiesResponse,
  MediaCloseTransportPayload,
  MediaCloseTransportResponse,
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
  MediaRestartIcePayload,
  MediaRestartIceResponse,
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

  /**
   * Acked, because every refusal is one the listener has to see on the row they tapped:
   * a channel with no producer, a socket that never joined the channel, and a repeat
   * inside the cooldown all resolve to a reason rather than to silence.
   */
  'channel:report': event({ payload: ChannelReportPayload, response: ChannelReportResponse }),

  /** Resolves this connection's open reporting episode and clears its active problems. */
  'channel:resolve-reports': event({
    payload: ChannelResolveReportsPayload,
    response: ChannelResolveReportsResponse,
  }),

  /**
   * The four handover verbs. Each is acked, because every refusal is one the interpreter
   * has to see on the control they pressed: a request while another is pending, a takeover
   * before the server's deadline, and a confirm from a studio that no longer holds the
   * channel all resolve to a reason rather than to silence. None carries a payload — the
   * server reads the channel and the studio session from the caller's own authorization.
   */
  'handover:request': event({
    payload: HandoverActionPayload,
    response: HandoverActionResponse,
  }),
  'handover:cancel': event({ payload: HandoverActionPayload, response: HandoverActionResponse }),
  'handover:confirm': event({ payload: HandoverActionPayload, response: HandoverActionResponse }),
  'handover:take-over': event({
    payload: HandoverActionPayload,
    response: HandoverActionResponse,
  }),

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
  'media:restart-ice': event({
    payload: MediaRestartIcePayload,
    response: MediaRestartIceResponse,
  }),

  /**
   * Releases the direction so the client may open a fresh one on the same socket. An ICE
   * restart re-gathers on the browser's existing peer connection, which after a network
   * handoff can be holding a stale set of interfaces; only a new peer connection sees the
   * network as it now is, and the one-per-direction cap makes that impossible until the
   * old transport is gone.
   */
  'media:close-transport': event({
    payload: MediaCloseTransportPayload,
    response: MediaCloseTransportResponse,
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

  /**
   * To the speaker's socket alone, on consumer lifecycle: nobody else has a use for the
   * number and a listener churning does not concern the event room.
   */
  'channel:listeners': event({ payload: ChannelListeners }),

  /**
   * To the socket holding the channel's speaker claim, like `channel:listeners`: the same
   * audience, and the same reason. A snapshot sent when a studio gains the claim; the series
   * is extended afterwards from `channel:listeners`, never from a second snapshot.
   */
  'channel:listener-history': event({ payload: ChannelListenerHistory }),

  /**
   * To the socket holding the channel's speaker claim, like `channel:listeners` and for the
   * same reason: the tally is addressed to the one person who can fix what it reports, and
   * a listener has no business seeing what other listeners reported.
   */
  'channel:reports': event({ payload: ChannelReports }),

  /**
   * To one studio socket, built for that studio: it says who holds the claim and what this
   * studio's own part in any handover is. Sent unconditionally on connect and again on
   * every claim or handover change, so a studio never has to infer state from silence.
   */
  'handover:state': event({ payload: HandoverState }),

  /** Discard every held media identifier and renegotiate; the socket itself survives. */
  'media:reset': event({ payload: MediaReset }),
} as const;
