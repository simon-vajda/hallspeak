import { randomBytes, randomInt } from 'node:crypto';

/**
 * Six digits, zero-padded. Deliberately not a larger alphabet: the PIN is read aloud
 * from the front of a room and typed on a phone keypad, where "was that an M or an N"
 * costs more than the entropy buys. The residual enumeration risk is capped by the
 * rate limiter, not by the length (spec E §3, §6).
 */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * An opaque 32-character token, never a JWT: the request that checks it already reads
 * the channel row, so stateless verification buys nothing and works against
 * regeneration — revoking a JWT early needs a blocklist, which is a lookup with extra
 * steps. Deleting and replacing a random string revokes instantly (spec E §5).
 */
export function generateSpeakerCode(): string {
  return randomBytes(24).toString('base64url');
}
