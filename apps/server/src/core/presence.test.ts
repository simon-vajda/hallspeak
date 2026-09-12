import { describe, expect, it } from 'vitest';
import type { Notification } from './notifications';
import { PresenceRegistry, type StudioSocket } from './presence';

const EVENT = 1;
const ENGLISH = 10;
const SPANISH = 11;

const studio = (sessionId: string, socketId: string, channelId = ENGLISH): StudioSocket => ({
  eventId: EVENT,
  channelId,
  sessionId,
  socketId,
});

const setup = (now?: () => number) => {
  const published: Notification[] = [];
  const presence = new PresenceRegistry({ publish: (n) => published.push(n), now });
  return { presence, published };
};

const claimChanges = (published: Notification[]) =>
  published.filter((n) => n.type === 'claim-changed');

describe('PresenceRegistry.registerStudio', () => {
  it('claims nothing: an open studio in pre-flight is not a broadcast', () => {
    const { presence, published } = setup();

    presence.registerStudio(studio('session-a', 'socket-a'));

    expect(presence.holder(ENGLISH)).toBeUndefined();
    expect(claimChanges(published)).toEqual([]);
  });

  it('leaves a live studio alone when a second one with the same code connects', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    presence.registerStudio(studio('session-b', 'socket-b'));

    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-a',
    });
    expect(claimChanges(published)).toEqual([]);
  });

  it('rebinds the claim to the same session reconnecting on a new socket', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    presence.registerStudio(studio('session-a', 'socket-b'));

    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-b',
    });
    expect(claimChanges(published)).toEqual([
      {
        type: 'claim-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        sessionId: 'session-a',
        socketId: 'socket-b',
      },
    ]);
  });

  it('publishes nothing when the holding socket registers again', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    presence.registerStudio(studio('session-a', 'socket-a'));

    expect(claimChanges(published)).toEqual([]);
  });

  it('tracks every connected studio on the channel', () => {
    const { presence } = setup();
    presence.registerStudio(studio('session-a', 'socket-a'));
    presence.registerStudio(studio('session-b', 'socket-b'));
    presence.registerStudio(studio('session-c', 'socket-c', SPANISH));

    expect(
      presence
        .studios(ENGLISH)
        .map((s) => s.socketId)
        .sort(),
    ).toEqual(['socket-a', 'socket-b']);
    expect(presence.studios(SPANISH).map((s) => s.sessionId)).toEqual(['session-c']);
  });

  it('drops a studio socket from the set when it is released', () => {
    const { presence } = setup();
    presence.registerStudio(studio('session-a', 'socket-a'));
    presence.registerStudio(studio('session-b', 'socket-b'));

    presence.release('socket-a');

    expect(presence.studios(ENGLISH).map((s) => s.socketId)).toEqual(['socket-b']);
  });

  it('keeps one entry per socket across a rebind of the same session', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));
    presence.registerStudio(studio('session-a', 'socket-b'));

    expect(
      presence
        .studios(ENGLISH)
        .map((s) => s.socketId)
        .sort(),
    ).toEqual(['socket-a', 'socket-b']);

    presence.release('socket-a');

    expect(presence.studios(ENGLISH).map((s) => s.socketId)).toEqual(['socket-b']);
  });
});

describe('PresenceRegistry.take', () => {
  it('grants a free channel to the first session that goes live', () => {
    const { presence, published } = setup();

    expect(presence.take(studio('session-a', 'socket-a'))).toBe(true);
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-a',
    });
    expect(claimChanges(published)).toEqual([
      {
        type: 'claim-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        sessionId: 'session-a',
        socketId: 'socket-a',
      },
    ]);
  });

  it('refuses a second session while the first holds the claim', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    expect(presence.take(studio('session-b', 'socket-b'))).toBe(false);
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-a',
    });
    expect(claimChanges(published)).toEqual([]);
  });

  it('is idempotent for the session that already holds it', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    expect(presence.take(studio('session-a', 'socket-a'))).toBe(true);
    expect(claimChanges(published)).toEqual([]);
  });

  it('rebinds when the holding session takes it again from a newer socket', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));

    expect(presence.take(studio('session-a', 'socket-b'))).toBe(true);
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-b',
    });
  });

  it('tracks channels independently', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));

    expect(presence.holder(SPANISH)).toBeUndefined();
    expect(presence.take(studio('session-b', 'socket-b', SPANISH))).toBe(true);
  });

  it('registers the taking studio, so a channel-wide snapshot sees it', () => {
    const { presence } = setup();

    presence.take(studio('session-a', 'socket-a'));

    expect(presence.studios(ENGLISH).map((s) => s.socketId)).toEqual(['socket-a']);
  });
});

describe('PresenceRegistry.move', () => {
  it('hands the claim to another session and names the socket that held it', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    expect(presence.move(studio('session-b', 'socket-b'))).toBe('socket-a');
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-b',
      socketId: 'socket-b',
    });
    expect(claimChanges(published)).toEqual([
      {
        type: 'claim-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        sessionId: 'session-b',
        socketId: 'socket-b',
      },
    ]);
  });

  it('names nobody when the channel was free', () => {
    const { presence } = setup();

    expect(presence.move(studio('session-b', 'socket-b'))).toBe(null);
    expect(presence.holder(ENGLISH)).toBe('socket-b');
  });

  it('leaves the socket that lost the claim registered as a studio', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));

    presence.move(studio('session-b', 'socket-b'));

    expect(
      presence
        .studios(ENGLISH)
        .map((s) => s.socketId)
        .sort(),
    ).toEqual(['socket-a', 'socket-b']);
  });
});

describe('PresenceRegistry.release', () => {
  it('frees the channel when the holding socket is released', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    expect(presence.release('socket-a')).toBe(ENGLISH);
    expect(presence.holder(ENGLISH)).toBeUndefined();
    expect(claimChanges(published)).toEqual([
      {
        type: 'claim-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        sessionId: null,
        socketId: null,
      },
    ]);
  });

  it('returns null when releasing a socket that held nothing', () => {
    const { presence } = setup();

    expect(presence.release('listener-socket')).toBe(null);
  });

  it('frees nothing, and publishes nothing, when a replaced socket is released', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    presence.registerStudio(studio('session-a', 'socket-b'));
    published.length = 0;

    expect(presence.release('socket-a')).toBe(null);
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-b',
    });
    expect(claimChanges(published)).toEqual([]);
  });

  /** The other order of the same pair: the drop lands before the reconnect. */
  it('lets the same session take the claim back after its own socket was released first', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));

    expect(presence.release('socket-a')).toBe(ENGLISH);
    expect(presence.take(studio('session-a', 'socket-b'))).toBe(true);
    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-a',
      socketId: 'socket-b',
    });
  });

  it('does not let a socket that lost a grant evict the session that won it', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));
    presence.move(studio('session-b', 'socket-b'));

    expect(presence.release('socket-a')).toBe(null);
    expect(presence.holder(ENGLISH)).toBe('socket-b');
  });
});

describe('PresenceRegistry.releaseChannel', () => {
  it('frees the claim on a deliberate end and reports who held it', () => {
    const { presence, published } = setup();
    presence.take(studio('session-a', 'socket-a'));
    published.length = 0;

    expect(presence.releaseChannel(ENGLISH)).toBe('socket-a');
    expect(presence.holder(ENGLISH)).toBeUndefined();
    expect(claimChanges(published)).toEqual([
      {
        type: 'claim-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        sessionId: null,
        socketId: null,
      },
    ]);
  });

  it('leaves the studio connected, so it can go live again without reconnecting', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));

    presence.releaseChannel(ENGLISH);

    expect(presence.studios(ENGLISH).map((s) => s.socketId)).toEqual(['socket-a']);
    expect(presence.take(studio('session-a', 'socket-a'))).toBe(true);
  });

  it('frees the channel for a studio that was waiting in pre-flight', () => {
    const { presence } = setup();
    presence.take(studio('session-a', 'socket-a'));
    presence.registerStudio(studio('session-b', 'socket-b'));

    presence.releaseChannel(ENGLISH);

    expect(presence.take(studio('session-b', 'socket-b'))).toBe(true);
  });

  it('returns null, and publishes nothing, for a channel nobody holds', () => {
    const { presence, published } = setup();

    expect(presence.releaseChannel(ENGLISH)).toBe(null);
    expect(claimChanges(published)).toEqual([]);
  });
});

describe('PresenceRegistry broadcast start', () => {
  const clock = () => {
    let value = 1_000;
    return { read: () => value, advance: (by: number) => (value += by) };
  };

  it('starts the clock when a free channel goes on air', () => {
    const time = clock();
    const { presence } = setup(time.read);

    presence.take(studio('session-a', 'socket-a'));

    expect(presence.claimOf(ENGLISH)?.startedAt).toBe(1_000);
  });

  it('keeps it across a handover, so the incoming studio continues the broadcast', () => {
    const time = clock();
    const { presence } = setup(time.read);
    presence.take(studio('session-a', 'socket-a'));
    time.advance(125_000);

    presence.move(studio('session-b', 'socket-b'));

    expect(presence.claimOf(ENGLISH)).toMatchObject({
      sessionId: 'session-b',
      startedAt: 1_000,
    });
  });

  it('takes the start a move names when nobody holds the channel any more', () => {
    const time = clock();
    const { presence } = setup(time.read);
    presence.take(studio('session-a', 'socket-a'));
    presence.release('socket-a');
    time.advance(30_000);

    presence.move(studio('session-b', 'socket-b'), 1_000);

    expect(presence.claimOf(ENGLISH)?.startedAt).toBe(1_000);
  });

  it('keeps it across the same studio reconnecting', () => {
    const time = clock();
    const { presence } = setup(time.read);
    presence.take(studio('session-a', 'socket-a'));
    time.advance(9_000);

    presence.registerStudio(studio('session-a', 'socket-b'));

    expect(presence.claimOf(ENGLISH)?.startedAt).toBe(1_000);
  });

  it('starts a fresh one for the next broadcast after the channel was released', () => {
    const time = clock();
    const { presence } = setup(time.read);
    presence.take(studio('session-a', 'socket-a'));
    time.advance(60_000);
    presence.releaseChannel(ENGLISH);

    presence.take(studio('session-b', 'socket-b'));

    expect(presence.claimOf(ENGLISH)?.startedAt).toBe(61_000);
  });
});
