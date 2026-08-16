import { describe, expect, it } from 'vitest';
import { PresenceRegistry } from './presence';

describe('PresenceRegistry', () => {
  it('reports a channel offline until a speaker claims it', () => {
    const presence = new PresenceRegistry();

    expect(presence.isOnline(1)).toBe(false);
    expect(presence.claim(1, 'socket-a')).toBe(true);
    expect(presence.isOnline(1)).toBe(true);
  });

  // First connection wins: the incumbent is never disturbed (spec E §7).
  it('refuses a second claim on a live channel', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, 'socket-a');

    expect(presence.claim(1, 'socket-b')).toBe(false);
    expect(presence.isOnline(1)).toBe(true);
  });

  it('frees the channel when the holding socket is released', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, 'socket-a');

    expect(presence.release('socket-a')).toBe(1);
    expect(presence.isOnline(1)).toBe(false);
    expect(presence.claim(1, 'socket-b')).toBe(true);
  });

  it('returns null when releasing a socket that held nothing', () => {
    const presence = new PresenceRegistry();

    expect(presence.release('listener-socket')).toBe(null);
  });

  it('does not let a stale release free a channel a different socket now holds', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, 'socket-a');
    presence.release('socket-a');
    presence.claim(1, 'socket-b');

    expect(presence.release('socket-a')).toBe(null);
    expect(presence.isOnline(1)).toBe(true);
  });

  it('tracks channels independently', () => {
    const presence = new PresenceRegistry();
    presence.claim(1, 'socket-a');

    expect(presence.isOnline(2)).toBe(false);
    expect(presence.claim(2, 'socket-b')).toBe(true);
  });
});
