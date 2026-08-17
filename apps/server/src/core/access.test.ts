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
  it('rejects an old client', () => {
    expect(authorizeHandshake(db, presence, { clientVersion: '0.0.1', pin }, 's')).toEqual({
      ok: false,
      error: 'client_too_old',
    });
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
  it('rejects a second speaker on a live channel and leaves the incumbent alone', () => {
    expect(auth({ pin, speakerCode: english.speakerCode }, 'incumbent').ok).toBe(true);

    expect(auth({ pin, speakerCode: english.speakerCode }, 'latecomer')).toEqual({
      ok: false,
      error: 'channel_busy',
    });
    expect(presence.isOnline(english.id)).toBe(true);
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
    auth({ pin }, 'listener');

    expect(presence.release('listener')).toBe(null);
  });
});
