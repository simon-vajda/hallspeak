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

export const ChannelJoinResponse = z.object({ online: z.boolean() });

export const ChannelLeavePayload = z.object({ slug: SocketSlug });

export const ChannelStatus = z.object({ slug: SocketSlug, online: z.boolean() });
