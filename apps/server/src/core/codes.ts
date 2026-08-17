import { randomBytes, randomInt } from 'node:crypto';

/**
 * Digits only, because the PIN is read aloud in a room and typed on a keypad. The
 * enumeration risk that leaves is capped by the rate limiter, not by the length.
 */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Opaque, never a JWT: the request that checks it already reads the channel row, and
 * replacing a random string revokes instantly where a JWT would need a blocklist.
 */
export function generateSpeakerCode(): string {
  return randomBytes(24).toString('base64url');
}
