import { z } from 'zod';
import { PIN_PATTERN, SEMVER_PATTERN, SLUG_PATTERN } from './patterns';

/**
 * Sent as `socket.handshake.auth` and checked by the server's connection gate.
 *
 * Strict x.y.z, no prerelease. This regex is what makes the comparison in the gate
 * total: `semverLt` can be a numeric tuple compare rather than a dependency or a
 * partial hand-rolled parser, because malformed and prerelease versions are rejected
 * at the schema boundary instead of mis-sorted at the comparison.
 *
 * Authorization is established here, once, rather than per message — the same reason
 * version drift is handled here. `pin` scopes the socket to an event; `speakerCode`,
 * when present, additionally scopes it to one channel to broadcast on.
 */
export const Handshake = z.object({
  clientVersion: z.string().regex(SEMVER_PATTERN),
  pin: z.string().regex(PIN_PATTERN),
  speakerCode: z.string().min(1).optional(),
});

export const PingPayload = z.object({});

export const PingResponse = z.object({ serverTime: z.int() });

// Zod, not @hono/zod-openapi: this file is reachable from '@linguacast/contract/socket'
// and must not drag Hono into a browser bundle.
const SocketSlug = z.string().min(1).max(40).regex(SLUG_PATTERN);

export const ChannelJoinPayload = z.object({ slug: SocketSlug });

/** The channel's liveness at the moment of joining, so a page need not wait for a change. */
export const ChannelJoinResponse = z.object({ online: z.boolean() });

export const ChannelLeavePayload = z.object({ slug: SocketSlug });

export const ChannelStatus = z.object({ slug: SocketSlug, online: z.boolean() });
