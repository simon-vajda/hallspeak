import { describe, expect, it } from 'vitest';
import { PresenceRegistry } from './presence';

const CODE = 'code-english';
const OTHER_CODE = 'code-someone-else';

describe('PresenceRegistry.claim', () => {
  it('grants a free channel to the first speaker', () => {
    const presence = new PresenceRegistry();

    expect(presence.claim(1, CODE, 'socket-a')).toEqual({ ok: true, displaced: null });
    expect(presence.holder(1)).toBe('socket-a');
  });

  it('refuses a different code on a held channel as busy', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.claim(1, OTHER_CODE, 'socket-b')).toEqual({ ok: false });
    expect(presence.holder(1)).toBe('socket-a');
  });

  // The reconnect case: the interpreter's own dying socket must not lock them out.
  it('grants the same code on a held channel and reports the displaced socket', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.claim(1, CODE, 'socket-b')).toEqual({ ok: true, displaced: 'socket-a' });
    expect(presence.holder(1)).toBe('socket-b');
  });

  it('displaces nobody when the same socket claims twice', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.claim(1, CODE, 'socket-a')).toEqual({ ok: true, displaced: null });
  });

  it('tracks channels independently', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.holder(2)).toBeUndefined();
    expect(presence.claim(2, OTHER_CODE, 'socket-b').ok).toBe(true);
  });
});

describe('PresenceRegistry.release', () => {
  it('frees the channel when the holding socket is released', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.release('socket-a')).toBe(1);
    expect(presence.holder(1)).toBeUndefined();
    expect(presence.claim(1, OTHER_CODE, 'socket-b').ok).toBe(true);
  });

  it('returns null when releasing a socket that held nothing', () => {
    const presence = new PresenceRegistry();

    expect(presence.release('listener-socket')).toBe(null);
  });

  it('does not let a stale release free a channel a different socket now holds', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');
    presence.release('socket-a');
    presence.claim(1, OTHER_CODE, 'socket-b');

    expect(presence.release('socket-a')).toBe(null);
    expect(presence.holder(1)).toBe('socket-b');
  });

  // The same guard, now reachable without a disconnect in between.
  it('does not let a displaced socket evict the successor that took it over', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');
    presence.claim(1, CODE, 'socket-b');

    expect(presence.release('socket-a')).toBe(null);
    expect(presence.holder(1)).toBe('socket-b');
  });
});

describe('PresenceRegistry.releaseChannel', () => {
  it('drops the claim and reports who held it, for admin revocation', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, CODE, 'socket-a');

    expect(presence.releaseChannel(1)).toBe('socket-a');
    expect(presence.holder(1)).toBeUndefined();
  });

  it('returns null for a channel nobody holds', () => {
    const presence = new PresenceRegistry();
    expect(presence.releaseChannel(1)).toBe(null);
  });
});
