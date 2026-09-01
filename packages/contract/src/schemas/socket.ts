import { z } from 'zod';
import { PIN_PATTERN, SEMVER_PATTERN, SLUG_PATTERN } from './patterns';

/**
 * Sent as `socket.handshake.auth`; authorization is established here once, not per message.
 * Rejecting prerelease versions is what lets the gate's `semverLt` be a numeric tuple compare.
 */
export const Handshake = z.object({
  clientVersion: z.string().regex(SEMVER_PATTERN),
  pin: z.string().regex(PIN_PATTERN),
  speakerCode: z.string().min(1).optional(),
});

export const PingPayload = z.object({});

export const PingResponse = z.object({ serverTime: z.int() });

// Zod, not @hono/zod-openapi: this file must not drag Hono into a browser bundle.
const SocketSlug = z.string().min(1).max(40).regex(SLUG_PATTERN);

export const ChannelJoinPayload = z.object({ slug: SocketSlug });

export const ChannelJoinResponse = z.object({ online: z.boolean(), muted: z.boolean() });

export const ChannelLeavePayload = z.object({ slug: SocketSlug });

export const ChannelStatus = z.object({
  slug: SocketSlug,
  online: z.boolean(),
  muted: z.boolean(),
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

export const ChannelReportPayload = z.object({ slug: SocketSlug, category: ReportCategory });

export const ChannelReportResponse = z.object({});

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
});

/**
 * mediasoup's capability, ICE, DTLS and RTP structures cross the wire as validated but
 * opaque objects: this package compiles with `"types": []` and no DOM and must never
 * import mediasoup. Loose rather than strict, so every key survives the round trip —
 * stripping one silently breaks negotiation with no error anywhere.
 */
const MediaParams = z.looseObject({});

const MediaId = z.string().min(1).max(200);

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
