import { Handshake } from '@linguacast/contract/schemas';
import type { Db } from '../db/client';
import { semverLt } from '../lib/semver';
import { MIN_MOBILE_VERSION, SERVER_VERSION } from '../version';
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
  // Emitted only to a bundle that predates `clientType`, which maps no other code to the
  // reload message. Nothing this repository still ships can receive it.
  | 'client_too_old'
  | 'web_version_mismatch'
  | 'mobile_version_too_old'
  | 'not_found'
  | 'invalid_speaker_code'
  | 'channel_busy';

/**
 * `displacedSocketId` is a one-shot fact about this connection, not standing state, which
 * is why it sits beside `data` rather than inside it: it never belongs in `socket.data`.
 */
export type AuthorizeResult =
  | { ok: true; data: SocketAuth; displacedSocketId: string | null }
  | { ok: false; error: HandshakeError };

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
  if (!parsed.success) {
    return { ok: false, error: 'invalid_handshake' };
  }
  if (parsed.data.clientType === 'web' && parsed.data.clientVersion !== SERVER_VERSION) {
    // A tab holding a bundle from before `clientType` existed knows only `client_too_old`,
    // and would print a generic connection failure at the moment it needs to be told to
    // reload. The field is defaulted rather than required so that tab reaches this gate at
    // all; the old code is what makes reaching it useful. Both go once no bundle predating
    // server 0.4.0 can still be open.
    const declaredType = typeof auth === 'object' && auth !== null && 'clientType' in auth;

    return { ok: false, error: declaredType ? 'web_version_mismatch' : 'client_too_old' };
  }
  if (
    parsed.data.clientType === 'mobile' &&
    semverLt(parsed.data.clientVersion, MIN_MOBILE_VERSION)
  ) {
    return { ok: false, error: 'mobile_version_too_old' };
  }

  const event = findEnabledEventByPin(db, parsed.data.pin);
  if (!event) {
    return { ok: false, error: 'not_found' };
  }

  const { speakerCode } = parsed.data;
  if (speakerCode === undefined) {
    return {
      ok: true,
      data: { eventId: event.id, pin: event.pin, speakerChannelId: null },
      displacedSocketId: null,
    };
  }

  const channel = findEnabledChannelBySpeakerCode(db, speakerCode);
  // The code identifies a channel on its own, so the handshake names the event twice;
  // disagreement is an error, not a case where one side wins.
  if (!channel || channel.eventId !== event.id) {
    return { ok: false, error: 'invalid_speaker_code' };
  }

  // Another code holds it: busy. The same code takes it over, and the loser is named so
  // the caller can close its media and its socket.
  const claim = presence.claim(channel.id, speakerCode, socketId);
  if (!claim.ok) {
    return { ok: false, error: 'channel_busy' };
  }

  return {
    ok: true,
    data: { eventId: event.id, pin: event.pin, speakerChannelId: channel.id },
    displacedSocketId: claim.displaced,
  };
}
