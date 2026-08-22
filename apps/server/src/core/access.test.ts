import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestDb } from '../db/testing';
import { MIN_CLIENT_VERSION } from '../version';
import { authorizeHandshake } from './access';
import { createChannel } from './channels.service';
import { createEvent } from './events.service';
import { PresenceRegistry } from './presence';

let db: Db;
let cleanup: () => void;
let presence: PresenceRegistry;

// A live event with two enabled channels and one disabled one.
let pin: string;
let english: { id: number; speakerCode: string };
let spanish: { id: number; speakerCode: string };
let germanDisabled: { speakerCode: string };
let otherEventPin: string;
let otherEventChannelCode: string;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  presence = new PresenceRegistry();

  const event = createEvent(db, { name: 'Sunday', enabled: true });
  pin = event.pin;
  english = createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true });
  spanish = createChannel(db, event.id, { slug: 'spanish', name: 'Spanish', enabled: true });
  germanDisabled = createChannel(db, event.id, { slug: 'german', name: 'German' });

  const other = createEvent(db, { name: 'Conference', enabled: true });
  otherEventPin = other.pin;
  otherEventChannelCode = createChannel(db, other.id, {
    slug: 'english',
    name: 'English',
    enabled: true,
  }).speakerCode;
});

afterEach(() => {
  cleanup();
});

const auth = (payload: Record<string, unknown>, socketId = 'socket-1') =>
  authorizeHandshake(db, presence, { clientVersion: MIN_CLIENT_VERSION, ...payload }, socketId);

describe('authorizeHandshake', () => {
  it('admits a listener with a valid pin', () => {
    const result = auth({ pin });

    expect(result).toEqual({
      ok: true,
      data: { eventId: expect.any(Number), pin, speakerChannelId: null },
      displacedSocketId: null,
    });
  });

  it('rejects an unknown pin', () => {
    expect(auth({ pin: '000000' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects a disabled event', () => {
    const hidden = createEvent(db, { name: 'Next Month' });

    expect(auth({ pin: hidden.pin })).toEqual({ ok: false, error: 'not_found' });
  });

  // The version gate fires before the database is touched.
  it('rejects the previous socket protocol and admits the current one', () => {
    expect(authorizeHandshake(db, presence, { clientVersion: '0.1.0', pin }, 'old')).toEqual({
      ok: false,
      error: 'client_too_old',
    });
    expect(
      authorizeHandshake(db, presence, { clientVersion: '0.2.0', pin }, 'current'),
    ).toMatchObject({ ok: true, data: { pin } });
  });

  it('rejects a malformed handshake', () => {
    expect(authorizeHandshake(db, presence, {}, 's')).toEqual({
      ok: false,
      error: 'invalid_handshake',
    });
    expect(authorizeHandshake(db, presence, undefined, 's')).toEqual({
      ok: false,
      error: 'invalid_handshake',
    });
    expect(auth({ pin: '12345' })).toEqual({ ok: false, error: 'invalid_handshake' });
  });

  it('admits a speaker with the matching code', () => {
    const result = auth({ pin, speakerCode: english.speakerCode });

    expect(result).toMatchObject({ ok: true, data: { speakerChannelId: english.id } });
  });

  it('rejects a speaker code belonging to a different event', () => {
    expect(auth({ pin, speakerCode: otherEventChannelCode })).toEqual({
      ok: false,
      error: 'invalid_speaker_code',
    });
    expect(auth({ pin: otherEventPin, speakerCode: english.speakerCode })).toEqual({
      ok: false,
      error: 'invalid_speaker_code',
    });
  });

  it('rejects a speaker code for a disabled channel', () => {
    expect(auth({ pin, speakerCode: germanDisabled.speakerCode })).toEqual({
      ok: false,
      error: 'invalid_speaker_code',
    });
  });

  it('rejects a nonsense speaker code', () => {
    expect(auth({ pin, speakerCode: 'nope' })).toEqual({
      ok: false,
      error: 'invalid_speaker_code',
    });
  });
});

describe('speaker exclusivity', () => {
  /**
   * Only reachable by claiming the channel behind the handshake's back: a speaker code
   * identifies exactly one channel, so no second code can route to this one through
   * `authorizeHandshake`. The guard still has to hold — the claim outlives a
   * regenerated code, and the old value must not become a key to somebody else's channel.
   */
  it('refuses a different code on a held channel as busy, leaving the holder alone', () => {
    presence.claim(english.id, 'a-superseded-code', 'squatter');

    expect(auth({ pin, speakerCode: english.speakerCode }, 'latecomer')).toEqual({
      ok: false,
      error: 'channel_busy',
    });
    expect(presence.holder(english.id)).toBe('squatter');
  });

  /**
   * The reconnect case, which is why the claim is keyed on the speaker code: the
   * interpreter's own dying socket lives for up to the ten-second ping window, and keying
   * on the socket id would refuse them their own channel for that long.
   */
  it('grants the same code a takeover and names the socket it displaced', () => {
    auth({ pin, speakerCode: english.speakerCode }, 'incumbent');

    const result = auth({ pin, speakerCode: english.speakerCode }, 'reconnecting');

    expect(result.ok).toBe(true);
    expect(result.ok && result.displacedSocketId).toBe('incumbent');
    expect(presence.holder(english.id)).toBe('reconnecting');
  });

  it('names nobody as displaced on an ordinary first claim', () => {
    const result = auth({ pin, speakerCode: english.speakerCode }, 'first');

    expect(result.ok && result.displacedSocketId).toBe(null);
  });

  it('does not let the displaced socket evict its successor when it finally disconnects', () => {
    auth({ pin, speakerCode: english.speakerCode }, 'incumbent');
    auth({ pin, speakerCode: english.speakerCode }, 'reconnecting');

    expect(presence.release('incumbent')).toBe(null);
    expect(presence.holder(english.id)).toBe('reconnecting');
  });

  it('admits the same code once the incumbent disconnects', () => {
    auth({ pin, speakerCode: english.speakerCode }, 'incumbent');
    presence.release('incumbent');

    expect(auth({ pin, speakerCode: english.speakerCode }, 'latecomer').ok).toBe(true);
  });

  it('does not let one busy channel block another', () => {
    auth({ pin, speakerCode: english.speakerCode }, 'incumbent');

    expect(auth({ pin, speakerCode: spanish.speakerCode }, 'other').ok).toBe(true);
  });

  it('claims nothing for a listener', () => {
    const result = auth({ pin }, 'listener');

    expect(result.ok && result.displacedSocketId).toBe(null);
    expect(presence.release('listener')).toBe(null);
  });
});
