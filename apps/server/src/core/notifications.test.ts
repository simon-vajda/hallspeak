import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Notification, NotificationHub } from './notifications';

const opened: Notification = {
  type: 'producer-opened',
  eventId: 1,
  channelId: 10,
  slug: 'english',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NotificationHub', () => {
  it('delivers producer-opened and producer-closed with the channel they name', () => {
    const hub = new NotificationHub();
    const seen: Notification[] = [];
    hub.subscribe((n) => seen.push(n));

    hub.publish(opened);
    hub.publish({
      type: 'producer-closed',
      eventId: 1,
      channelId: 10,
      slug: 'english',
      reason: 'dropped',
    });

    expect(seen).toEqual([
      { type: 'producer-opened', eventId: 1, channelId: 10, slug: 'english' },
      {
        type: 'producer-closed',
        eventId: 1,
        channelId: 10,
        slug: 'english',
        reason: 'dropped',
      },
    ]);
  });

  it('delivers peer-evicted and room-evicted with their reason', () => {
    const hub = new NotificationHub();
    const seen: Notification[] = [];
    hub.subscribe((n) => seen.push(n));

    hub.publish({ type: 'peer-evicted', socketId: 'socket-a', reason: 'access_revoked' });
    hub.publish({ type: 'room-evicted', eventId: 2, reason: 'access_revoked' });

    expect(seen).toEqual([
      { type: 'peer-evicted', socketId: 'socket-a', reason: 'access_revoked' },
      { type: 'room-evicted', eventId: 2, reason: 'access_revoked' },
    ]);
  });

  it('delivers handover-changed and handover-granted naming both sessions', () => {
    const hub = new NotificationHub();
    const seen: Notification[] = [];
    hub.subscribe((n) => seen.push(n));

    hub.publish({ type: 'handover-changed', eventId: 1, channelId: 10 });
    hub.publish({
      type: 'handover-granted',
      eventId: 1,
      channelId: 10,
      fromSessionId: 'session-a',
      toSessionId: 'session-b',
    });

    expect(seen).toEqual([
      { type: 'handover-changed', eventId: 1, channelId: 10 },
      {
        type: 'handover-granted',
        eventId: 1,
        channelId: 10,
        fromSessionId: 'session-a',
        toSessionId: 'session-b',
      },
    ]);
  });

  it('stops delivering after unsubscribe', () => {
    const hub = new NotificationHub();
    const seen: Notification[] = [];
    const unsubscribe = hub.subscribe((n) => seen.push(n));

    unsubscribe();
    hub.publish(opened);

    expect(seen).toEqual([]);
  });

  it('delivers to every subscriber', () => {
    const hub = new NotificationHub();
    const first: Notification[] = [];
    const second: Notification[] = [];
    hub.subscribe((n) => first.push(n));
    hub.subscribe((n) => second.push(n));

    hub.publish(opened);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it('does not let one throwing subscriber stop the others', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const hub = new NotificationHub();
    const seen: Notification[] = [];
    hub.subscribe(() => {
      throw new Error('subscriber blew up');
    });
    hub.subscribe((n) => seen.push(n));

    expect(() => hub.publish(opened)).not.toThrow();
    expect(seen).toHaveLength(1);
  });

  it('logs a throwing subscriber rather than swallowing it silently', () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    const hub = new NotificationHub();
    hub.subscribe(() => {
      throw new Error('subscriber blew up');
    });

    hub.publish(opened);

    expect(errors).toHaveLength(1);
  });

  it('unsubscribing twice is a no-op', () => {
    const hub = new NotificationHub();
    const unsubscribe = hub.subscribe(() => {});
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});
