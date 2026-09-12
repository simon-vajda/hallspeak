import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestDb } from '../db/testing';
import { MIN_MOBILE_VERSION, SERVER_VERSION } from '../version';
import { authorizeHandshake } from './access';
import { createChannel } from './channels.service';
import { createEvent } from './events.service';
import { PresenceRegistry } from './presence';

let db: Db;
let cleanup: () => void;
let presence: PresenceRegistry;

// A live event with two enabled channels and one disabled one.
let eventId: number;
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
  eventId = event.id;
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

// Derived, never written down: a literal one release ahead becomes the server's own version
// the moment that release is cut, and the test asserting it is refused then fails the bump.
const NEWER_THAN_SERVER = `${Number(SERVER_VERSION.split('.')[0]) + 1}.0.0`;
const OLDER_THAN_SERVER = '0.0.1';

// The schema pairs a speaker code with a studio session, so a speaker fixture always
// carries one and a listener fixture never does. The session defaults to one per socket,
// which is the ordinary case: one page, one connection.
const auth = (
  payload: Record<string, unknown>,
  socketId = 'socket-1',
  studioSession = `${socketId}-studio`,
) =>
  authorizeHandshake(
    db,
    presence,
    {
      clientType: 'web',
      clientVersion: SERVER_VERSION,
      ...(payload.speakerCode === undefined ? {} : { studioSession }),
      ...payload,
    },
    socketId,
  );

const speaker = (socketId: string, studioSession: string, speakerCode = english.speakerCode) =>
  auth({ pin, speakerCode }, socketId, studioSession);

describe('authorizeHandshake', () => {
  it('admits a listener with a valid pin', () => {
    const result = auth({ pin });

    expect(result).toEqual({
      ok: true,
      data: { eventId: expect.any(Number), pin, speakerChannelId: null, studioSession: null },
    });
  });

  it('rejects an unknown pin', () => {
    expect(auth({ pin: '000000' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects a disabled event', () => {
    const hidden = createEvent(db, { name: 'Next Month' });

    expect(auth({ pin: hidden.pin })).toEqual({ ok: false, error: 'not_found' });
  });

  // Version gates fire before the database is touched.
  it('requires an exact server version from bundled web clients', () => {
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'web', clientVersion: OLDER_THAN_SERVER, pin },
        'old',
      ),
    ).toEqual({
      ok: false,
      error: 'web_version_mismatch',
    });
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'web', clientVersion: NEWER_THAN_SERVER, pin },
        'newer',
      ),
    ).toEqual({
      ok: false,
      error: 'web_version_mismatch',
    });
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'web', clientVersion: SERVER_VERSION, pin },
        'current',
      ),
    ).toMatchObject({ ok: true, data: { pin } });
  });

  // A bundle from before clientType existed maps only `client_too_old` to the reload
  // message, so it gets that code rather than the one its own copy cannot render.
  it('answers a handshake with no client type in the vocabulary that bundle knows', () => {
    expect(
      authorizeHandshake(db, presence, { clientVersion: OLDER_THAN_SERVER, pin }, 'legacy'),
    ).toEqual({ ok: false, error: 'client_too_old' });
    expect(
      authorizeHandshake(db, presence, { clientVersion: SERVER_VERSION, pin }, 'legacy-current'),
    ).toMatchObject({ ok: true, data: { pin } });
  });

  it('enforces only the configured floor for mobile clients', () => {
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'mobile', clientVersion: '0.0.1', pin },
        'old-mobile',
      ),
    ).toEqual({ ok: false, error: 'mobile_version_too_old' });
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'mobile', clientVersion: MIN_MOBILE_VERSION, pin },
        'current-mobile',
      ),
    ).toMatchObject({ ok: true, data: { pin } });
    expect(
      authorizeHandshake(
        db,
        presence,
        { clientType: 'mobile', clientVersion: '99.0.0', pin },
        'future-mobile',
      ),
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
    expect(auth({ clientType: 'desktop', pin })).toEqual({
      ok: false,
      error: 'invalid_handshake',
    });
  });

  it('admits a speaker with the matching code', () => {
    const result = auth({ pin, speakerCode: english.speakerCode });

    expect(result).toMatchObject({
      ok: true,
      data: { speakerChannelId: english.id, studioSession: 'socket-1-studio' },
    });
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

describe('studio sessions', () => {
  /**
   * Opening the studio is not a request to broadcast. A colleague checking their
   * microphone must leave the live interpreter's claim and connection alone.
   */
  it('claims nothing, so a second studio on the same code disturbs nobody', () => {
    speaker('incumbent', 'studio-incumbent');
    presence.take({
      eventId,
      channelId: english.id,
      sessionId: 'studio-incumbent',
      socketId: 'incumbent',
    });

    expect(speaker('colleague', 'studio-colleague').ok).toBe(true);
    expect(presence.claimOf(english.id)).toMatchObject({
      sessionId: 'studio-incumbent',
      socketId: 'incumbent',
    });
  });

  /**
   * The reconnect case, which is why the claim is keyed on a studio session: the
   * interpreter's own dying socket lives for up to the ten-second ping window, and keying
   * on the socket id would refuse them their own channel for that long.
   */
  it('rebinds the claim when the same studio reconnects on a new socket', () => {
    speaker('first', 'studio-a');
    presence.take({ eventId, channelId: english.id, sessionId: 'studio-a', socketId: 'first' });

    expect(speaker('second', 'studio-a').ok).toBe(true);
    expect(presence.claimOf(english.id)).toMatchObject({
      sessionId: 'studio-a',
      socketId: 'second',
    });
    expect(presence.release('first')).toBe(null);
    expect(presence.holder(english.id)).toBe('second');
  });

  it('registers every connected studio on the channel', () => {
    speaker('first', 'studio-a');
    speaker('second', 'studio-b');

    expect(
      presence
        .studios(english.id)
        .map((studio) => studio.sessionId)
        .sort(),
    ).toEqual(['studio-a', 'studio-b']);
  });

  it('registers nothing for a listener', () => {
    const result = auth({ pin }, 'listener');

    expect(result.ok && result.data.studioSession).toBe(null);
    expect(presence.release('listener')).toBe(null);
  });

  it('registers a studio per channel, not per event', () => {
    speaker('english-studio', 'studio-a');
    speaker('spanish-studio', 'studio-b', spanish.speakerCode);

    expect(presence.studios(english.id).map((studio) => studio.socketId)).toEqual([
      'english-studio',
    ]);
    expect(presence.studios(spanish.id).map((studio) => studio.socketId)).toEqual([
      'spanish-studio',
    ]);
  });

  /**
   * A channel has exactly one valid speaker code, so there is nothing left for the
   * handshake to refuse as busy: a wrong code is a wrong code.
   */
  it('refuses a superseded code rather than reporting the channel busy', () => {
    speaker('incumbent', 'studio-incumbent');

    expect(auth({ pin, speakerCode: 'a-superseded-code' }, 'latecomer')).toEqual({
      ok: false,
      error: 'invalid_speaker_code',
    });
  });
});
