import { z } from 'zod';
import { SEMVER_PATTERN } from './patterns';

/**
 * Sent as `socket.handshake.auth` and checked by the server's connection gate.
 *
 * Strict x.y.z, no prerelease. This regex is what makes the comparison in the gate
 * total: `semverLt` can be a numeric tuple compare rather than a dependency or a
 * partial hand-rolled parser, because malformed and prerelease versions are rejected
 * at the schema boundary instead of mis-sorted at the comparison.
 *
 * `code` is deliberately absent. Speaker and listener codes do not exist yet, and a
 * field the server ignores is worse than an absent one; it arrives with the spec that
 * introduces the lookup giving it meaning.
 */
export const Handshake = z.object({
  clientVersion: z.string().regex(SEMVER_PATTERN),
});

export const PingPayload = z.object({});

export const PingResponse = z.object({ serverTime: z.int() });
