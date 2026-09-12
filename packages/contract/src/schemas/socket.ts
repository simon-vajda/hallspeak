import { z } from 'zod';
import { PIN_PATTERN, SEMVER_PATTERN, SLUG_PATTERN } from './patterns';

/**
 * Sent as `socket.handshake.auth`; authorization is established here once, not per message.
 * Rejecting prerelease versions keeps release compatibility comparisons numeric.
 */
export const Handshake = z
  .object({
    // Defaulted rather than required: a tab still holding a bundle from before this field
    // existed must reach the version gate and be told to reload, not fail schema parsing and
    // get the generic invalid-handshake message instead.
    clientType: z.enum(['web', 'mobile']).default('web'),
    clientVersion: z.string().regex(SEMVER_PATTERN),
    pin: z.string().regex(PIN_PATTERN),
    speakerCode: z.string().min(1).optional(),
    /**
     * Identifies a studio page, never a person: generated once per page load and held in
     * memory, so a reload or a duplicated tab is a different studio. It is what lets the
     * server tell a studio's own reconnect from a colleague's studio holding the same code.
     */
    studioSession: z.string().min(8).max(64).optional(),
  })
  // Paired both ways: a broadcast claim is keyed on the session, so a speaker code without
  // one cannot be honoured, and a listener has no studio to identify.
  .refine((h) => (h.speakerCode === undefined) === (h.studioSession === undefined), {
    error: 'studioSession is required with a speaker code and rejected without one',
    path: ['studioSession'],
  });

export const PingPayload = z.object({});

export const PingResponse = z.object({ serverTime: z.int() });

// Zod, not @hono/zod-openapi: this file must not drag Hono into a browser bundle.
const SocketSlug = z.string().min(1).max(40).regex(SLUG_PATTERN);

const MediaId = z.string().min(1).max(200);

export const ChannelJoinPayload = z.object({ slug: SocketSlug });

/**
 * What is being broadcast on one channel, read as a whole so its parts cannot disagree.
 *
 * `producerId` is what lets a listener follow a replacement as one message rather than as a
 * close followed by an open — two messages a single render batch can collapse into silence.
 * `incomingProducerId` is set only inside a handover's swap window, while both interpreters
 * are transmitting: a listener consuming `producerId` opens this one paused, then resumes it
 * and closes the old one together, so it is never subscribed to two voices and hears no gap.
 * Both are null while offline.
 */
const BroadcastSnapshot = z.object({
  online: z.boolean(),
  muted: z.boolean(),
  producerId: MediaId.nullable(),
  incomingProducerId: MediaId.nullable(),
});

/**
 * The join ack is the same snapshot minus the slug the caller already named, so a guest
 * joining inside a swap window learns about both producers from its ack rather than waiting
 * for the next status and paying a gap at promotion.
 */
export const ChannelJoinResponse = BroadcastSnapshot;

export const ChannelLeavePayload = z.object({ slug: SocketSlug });

/** The broadcast snapshot addressed to a channel, with why it last went offline. */
export const ChannelStatus = BroadcastSnapshot.extend({
  slug: SocketSlug,
  reason: z.enum(['ended', 'dropped']).optional(),
});

/**
 * Separate from `ChannelStatus` on purpose: that one fans out to the event room on producer
 * lifecycle, this one goes to the speaker's socket alone on consumer lifecycle. Different
 * audience, different trigger, different frequency.
 */
export const ChannelListeners = z.object({ slug: SocketSlug, count: z.int().nonnegative() });

/**
 * Five fixed categories and nothing else: a report carries no text, no listener identifier
 * and no history, so the enum is the whole vocabulary and an unknown one is rejected by the
 * validation middleware before any handler runs.
 */
export const ReportCategory = z.enum(['quiet', 'loud', 'static', 'noise', 'silent']);

export type ReportCategory = z.infer<typeof ReportCategory>;

export const ChannelReportPayload = z.object({ slug: SocketSlug, category: ReportCategory });

export const ChannelReportResponse = z.object({});

export const ChannelResolveReportsPayload = z.object({ slug: SocketSlug });

export const ChannelResolveReportsResponse = z.object({});

/**
 * To the socket holding the channel's speaker claim alone, never to the channel room: the
 * tally is for the one person who can act on it, and a listener must not learn what other
 * listeners reported. `ageMs` rather than an absolute timestamp — the studio anchors each
 * row to its own clock at receipt, so a client clock minutes off the server's does not make
 * every age wrong by that offset.
 */
export const ChannelReports = z.object({
  slug: SocketSlug,
  rows: z.array(
    z.object({
      category: ReportCategory,
      count: z.int().positive(),
      ageMs: z.int().nonnegative(),
    }),
  ),
  /** Positive follow-up kept separate from the five problem categories. */
  soundsGood: z
    .object({
      count: z.int().positive(),
      ageMs: z.int().nonnegative(),
    })
    .nullable(),
});

export type ReportRow = z.infer<typeof ChannelReports>['rows'][number];

export type ReportResolution = z.infer<typeof ChannelReports>['soundsGood'];

/**
 * Every handover verb carries an empty payload on purpose: the server derives the channel
 * and the studio session from the caller's own authorization, so nothing a client sends can
 * name a studio other than itself
 * (`docs/solutions/conventions/an-identifier-returned-to-a-client-is-not-a-capability.md`).
 */
export const HandoverActionPayload = z.strictObject({});

export const HandoverActionResponse = z.object({});

/** Whether this studio holds the channel's broadcast claim, another studio does, or nobody. */
export const HandoverHolder = z.enum(['self', 'other', 'none']);

export type HandoverHolder = z.infer<typeof HandoverHolder>;

/**
 * This studio's own part in whatever is happening on the channel. `granted` means it may
 * produce now; `handing-over` means it is still transmitting while its successor starts.
 */
export const HandoverRole = z.enum(['live', 'waiting', 'granted', 'handing-over', 'bystander']);

export type HandoverRole = z.infer<typeof HandoverRole>;

/**
 * Built per studio socket and sent unconditionally on connect, like the report tally, so a
 * studio can tell "nothing pending" from "not heard yet". `remainingMs` rather than a
 * deadline timestamp, anchored at receipt for the same reason `ChannelReports` uses `ageMs`.
 * `canTakeOver` is the server's answer and never the client's arithmetic.
 */
export const HandoverState = z.object({
  slug: SocketSlug,
  holder: HandoverHolder,
  role: HandoverRole,
  /** True while any request or grant is in flight on the channel, whoever it belongs to. */
  pending: z.boolean(),
  remainingMs: z.int().nonnegative().nullable(),
  canTakeOver: z.boolean(),
  /**
   * How long the channel has been on air, across every interpreter who has held it: the
   * claim carries its start through a handover, so the incoming studio continues the
   * broadcast's clock rather than starting a second one. Null when nobody holds the
   * channel. A duration rather than a start time, anchored at receipt like `remainingMs`.
   */
  onAirMs: z.int().nonnegative().nullable(),
});

export type HandoverState = z.infer<typeof HandoverState>;

/**
 * mediasoup's capability, ICE, DTLS and RTP structures cross the wire as validated but
 * opaque objects: this package compiles with `"types": []` and no DOM and must never
 * import mediasoup. Loose rather than strict, so every key survives the round trip —
 * stripping one silently breaks negotiation with no error anywhere.
 */
const MediaParams = z.looseObject({});

/** The shape `RTCPeerConnection` takes, so the client hands it straight to mediasoup-client. */
export const IceServer = z.object({
  urls: z.array(z.string().min(1)).min(1),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const MediaCapabilitiesPayload = z.object({});

export const MediaCapabilitiesResponse = z.object({
  routerRtpCapabilities: MediaParams,
  /** Empty is valid and is what a deployment without coturn returns. */
  iceServers: z.array(IceServer),
});

export const MediaCreateTransportPayload = z.object({
  direction: z.enum(['send', 'recv']),
});

export const MediaCreateTransportResponse = z.object({
  id: MediaId,
  iceParameters: MediaParams,
  iceCandidates: z.array(MediaParams),
  dtlsParameters: MediaParams,
});

export const MediaConnectTransportPayload = z.object({
  transportId: MediaId,
  dtlsParameters: MediaParams,
});

export const MediaConnectTransportResponse = z.object({});

export const MediaRestartIcePayload = z.object({ transportId: MediaId });

export const MediaCloseTransportPayload = z.object({ transportId: MediaId });

export const MediaCloseTransportResponse = z.object({});

export const MediaRestartIceResponse = z.object({ iceParameters: MediaParams });

// Audio-only, as the product has always been; the literal is what rejects a video track.
export const MediaProducePayload = z.object({
  slug: SocketSlug,
  kind: z.literal('audio'),
  rtpParameters: MediaParams,
  paused: z.boolean(),
});

export const MediaProduceResponse = z.object({ producerId: MediaId });

/** Shared by close, pause and resume — all three name a producer and nothing else. */
export const MediaProducerPayload = z.object({ producerId: MediaId });

export const MediaProducerResponse = z.object({});

export const MediaConsumePayload = z.object({ slug: SocketSlug, rtpCapabilities: MediaParams });

export const MediaConsumeResponse = z.object({
  consumerId: MediaId,
  producerId: MediaId,
  kind: z.literal('audio'),
  rtpParameters: MediaParams,
});

/** Shared by resume and close. */
export const MediaConsumerPayload = z.object({ consumerId: MediaId });

export const MediaConsumerResponse = z.object({});

/**
 * Every identifier the client holds is void; renegotiate from capabilities. Sent when the
 * media under a socket disappears but the socket itself is fine, which a disconnect would
 * be too blunt for.
 */
export const MediaReset = z.object({
  reason: z.enum(['worker_died']),
});
