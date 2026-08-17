import { Handshake } from '@linguacast/contract/schemas';
import type { Db } from '../db/client';
import { semverLt } from '../lib/semver';
import { MIN_CLIENT_VERSION } from '../version';
import { findEnabledChannelBySpeakerCode } from './channels.service';
import { findEnabledEventByPin } from './events.service';
import type { PresenceRegistry } from './presence';

export interface SocketAuth {
  eventId: number;
  pin: string;
  /** The channel this socket may broadcast on, or null for a listener. */
  speakerChannelId: number | null;
}

export type HandshakeError =
  | 'invalid_handshake'
  | 'client_too_old'
  | 'not_found'
  | 'invalid_speaker_code'
  | 'channel_busy';

export type AuthorizeResult = { ok: true; data: SocketAuth } | { ok: false; error: HandshakeError };

/**
 * The entire connection-time decision, in one synchronous pass. Synchronous is
 * load-bearing: better-sqlite3 is, so the busy check and the claim that follows cannot
 * interleave with another socket's. On success it claims the channel; `presence.release`
 * on disconnect is the matching half.
 */
export function authorizeHandshake(
  db: Db,
  presence: PresenceRegistry,
  auth: unknown,
  socketId: string,
): AuthorizeResult {
  const parsed = Handshake.safeParse(auth);
  if (!parsed.success) return { ok: false, error: 'invalid_handshake' };
  if (semverLt(parsed.data.clientVersion, MIN_CLIENT_VERSION)) {
    return { ok: false, error: 'client_too_old' };
  }

  const event = findEnabledEventByPin(db, parsed.data.pin);
  if (!event) return { ok: false, error: 'not_found' };

  const { speakerCode } = parsed.data;
  if (speakerCode === undefined) {
    return { ok: true, data: { eventId: event.id, pin: event.pin, speakerChannelId: null } };
  }

  const channel = findEnabledChannelBySpeakerCode(db, speakerCode);
  // The code identifies a channel on its own, so the handshake names the event twice;
  // disagreement is an error, not a case where one side wins.
  if (!channel || channel.eventId !== event.id) {
    return { ok: false, error: 'invalid_speaker_code' };
  }

  // First connection wins; the incumbent is never disturbed.
  if (!presence.claim(channel.id, socketId)) return { ok: false, error: 'channel_busy' };

  return { ok: true, data: { eventId: event.id, pin: event.pin, speakerChannelId: channel.id } };
}
