import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GRANT_DEADLINE_MS,
  type GrantCancellation,
  HandoverRegistry,
  TAKEOVER_AFTER_MS,
} from './handover';
import type { Notification } from './notifications';
import { PresenceRegistry, type StudioSocket } from './presence';

const EVENT_ID = 1;
const CHANNEL_ID = 10;

const studio = (sessionId: string, socketId: string): StudioSocket => ({
  eventId: EVENT_ID,
  channelId: CHANNEL_ID,
  sessionId,
  socketId,
});

const holder = studio('session-holder', 'socket-holder');
const waiter = studio('session-waiter', 'socket-waiter');
const third = studio('session-third', 'socket-third');

function harness() {
  const published: Notification[] = [];
  const cancellations: GrantCancellation[] = [];
  const presence = new PresenceRegistry({ publish: () => {} });
  const registry = new HandoverRegistry({
    presence,
    publish: (notification) => published.push(notification),
  });
  registry.onGrantCancelled((cancellation) => cancellations.push(cancellation));
  return { cancellations, presence, published, registry };
}

const typesOf = (published: Notification[]) => published.map((notification) => notification.type);

/** A live channel: the holder's session owns the claim, as a produce would have left it. */
function live() {
  const context = harness();
  context.presence.take(holder);
  context.presence.registerStudio(waiter);
  return context;
}

describe('HandoverRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('request', () => {
    it('accepts a request from another studio on a claimed channel', () => {
      const { registry, published } = live();

      expect(registry.request(waiter)).toBe('accepted');
      expect(registry.view(CHANNEL_ID)?.request).toMatchObject({
        sessionId: waiter.sessionId,
        socketId: waiter.socketId,
      });
      expect(typesOf(published)).toEqual(['handover-changed']);
    });

    it('refuses a request on a channel nobody holds', () => {
      const { registry, published } = harness();

      expect(registry.request(waiter)).toBe('no_claim');
      expect(published).toEqual([]);
    });

    it("refuses a request from the holder's own session", () => {
      const { registry } = live();

      expect(registry.request(holder)).toBe('holds_claim');
    });

    it('refuses a second request while one is pending', () => {
      const { registry } = live();

      expect(registry.request(waiter)).toBe('accepted');
      expect(registry.request(third)).toBe('in_progress');
      expect(registry.view(CHANNEL_ID)?.request?.sessionId).toBe(waiter.sessionId);
    });

    it('refuses a third studio while a grant is in flight, and accepts it once the swap completes', () => {
      const { registry, presence } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      expect(registry.request(third)).toBe('in_progress');

      registry.produced(waiter);
      registry.complete(CHANNEL_ID);

      expect(presence.claimOf(CHANNEL_ID)?.sessionId).toBe(waiter.sessionId);
      expect(registry.request(third)).toBe('accepted');
    });
  });

  describe('takeOver', () => {
    it('refuses a take-over before the deadline and accepts it at the deadline', () => {
      const { registry } = live();
      registry.request(waiter);

      vi.advanceTimersByTime(TAKEOVER_AFTER_MS - 1);
      expect(registry.takeOver(waiter, 'producer-out')).toBe('too_soon');

      vi.advanceTimersByTime(1);
      expect(registry.takeOver(waiter, 'producer-out')).toBe('accepted');
      expect(registry.view(CHANNEL_ID)?.grant?.sessionId).toBe(waiter.sessionId);
    });

    it('refuses a take-over from a session that is not the waiter', () => {
      const { registry } = live();
      registry.request(waiter);
      vi.advanceTimersByTime(TAKEOVER_AFTER_MS);

      expect(registry.takeOver(third, null)).toBe('not_waiting');
      expect(registry.takeOver(holder, null)).toBe('not_waiting');
    });

    it('publishes a change when the take-over deadline arrives, without touching the request', async () => {
      const { registry, published } = live();
      registry.request(waiter);
      published.length = 0;

      await vi.advanceTimersByTimeAsync(TAKEOVER_AFTER_MS);

      expect(typesOf(published)).toEqual(['handover-changed']);
      expect(registry.canTakeOver(CHANNEL_ID, waiter.sessionId)).toBe(true);
      expect(registry.canTakeOver(CHANNEL_ID, third.sessionId)).toBe(false);
    });

    it('reports the remaining time the client displays', () => {
      const { registry } = live();
      registry.request(waiter);

      vi.advanceTimersByTime(10_000);

      expect(registry.remainingMs(CHANNEL_ID)).toBe(TAKEOVER_AFTER_MS - 10_000);
    });
  });

  describe('cancel', () => {
    it('clears the request for the waiter and publishes the change', () => {
      const { registry, published } = live();
      registry.request(waiter);
      published.length = 0;

      expect(registry.cancel(waiter)).toBe('accepted');
      expect(registry.view(CHANNEL_ID)?.request ?? null).toBeNull();
      expect(typesOf(published)).toEqual(['handover-changed']);
    });

    it('refuses a cancel from a session that is not the waiter', () => {
      const { registry } = live();
      registry.request(waiter);

      expect(registry.cancel(holder)).toBe('not_waiting');
      expect(registry.cancel(third)).toBe('not_waiting');
      expect(registry.view(CHANNEL_ID)?.request?.sessionId).toBe(waiter.sessionId);
    });

    it('refuses a cancel once the handover has been granted', () => {
      const { registry } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      expect(registry.cancel(waiter)).toBe('not_waiting');
    });
  });

  describe('confirm', () => {
    it('grants to the waiter and names both sessions', () => {
      const { registry, published } = live();
      registry.request(waiter);
      published.length = 0;

      expect(registry.confirm(holder, 'producer-out')).toBe('accepted');
      expect(published[0]).toEqual({
        type: 'handover-granted',
        eventId: EVENT_ID,
        channelId: CHANNEL_ID,
        fromSessionId: holder.sessionId,
        toSessionId: waiter.sessionId,
      });
      expect(typesOf(published)).toEqual(['handover-granted', 'handover-changed']);
    });

    it('refuses a confirm from a session that does not hold the claim', () => {
      const { registry } = live();
      registry.request(waiter);

      expect(registry.confirm(third, null)).toBe('not_holder');
      expect(registry.confirm(waiter, null)).toBe('not_holder');
    });

    it('refuses a confirm with nothing pending', () => {
      const { registry } = live();

      expect(registry.confirm(holder, null)).toBe('nothing_pending');
    });

    it('leaves the claim with the outgoing studio until the swap completes', () => {
      const { registry, presence } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      expect(presence.claimOf(CHANNEL_ID)?.sessionId).toBe(holder.sessionId);

      registry.produced(waiter);
      registry.complete(CHANNEL_ID);

      expect(presence.claimOf(CHANNEL_ID)).toMatchObject({
        sessionId: waiter.sessionId,
        socketId: waiter.socketId,
      });
    });

    it('yields exactly one grant when a confirm and a take-over arrive together', () => {
      const { registry, published } = live();
      registry.request(waiter);
      vi.advanceTimersByTime(TAKEOVER_AFTER_MS);
      published.length = 0;

      expect(registry.confirm(holder, 'producer-out')).toBe('accepted');
      expect(registry.takeOver(waiter, 'producer-out')).toBe('not_waiting');
      expect(published.filter((n) => n.type === 'handover-granted')).toHaveLength(1);
    });
  });

  describe('departure', () => {
    it('grants when a request is pending', () => {
      const { registry } = live();
      registry.request(waiter);

      const grant = registry.departed({ eventId: EVENT_ID, channelId: CHANNEL_ID }, null);

      expect(grant?.sessionId).toBe(waiter.sessionId);
      expect(registry.view(CHANNEL_ID)?.grant?.socketId).toBe(waiter.socketId);
    });

    it('grants nothing when no request is pending', () => {
      const { registry, published } = live();

      expect(registry.departed({ eventId: EVENT_ID, channelId: CHANNEL_ID }, null)).toBeNull();
      expect(published).toEqual([]);
    });
  });

  describe('a grant that is not completed', () => {
    it('asks media to close the recorded producer when the deadline passes', async () => {
      const { registry, cancellations, presence, published } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');
      published.length = 0;

      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS);

      expect(cancellations).toEqual([
        {
          eventId: EVENT_ID,
          channelId: CHANNEL_ID,
          sessionId: waiter.sessionId,
          socketId: waiter.socketId,
          producerId: 'producer-out',
        },
      ]);
      expect(registry.view(CHANNEL_ID)?.grant ?? null).toBeNull();
      expect(typesOf(published)).toEqual(['handover-changed']);
      expect(presence.claimOf(CHANNEL_ID)?.sessionId).toBe(holder.sessionId);
    });

    it('cancels at once when the granted socket disconnects, and disarms the deadline', async () => {
      const { registry, cancellations } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      registry.releaseSocket(waiter.socketId);

      expect(cancellations).toHaveLength(1);
      expect(cancellations[0]?.producerId).toBe('producer-out');

      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS * 2);

      expect(cancellations).toHaveLength(1);
    });

    it("leaves a later studio's broadcast and claim alone once the granted socket has gone", async () => {
      const { registry, cancellations, presence } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');
      registry.releaseSocket(waiter.socketId);
      cancellations.length = 0;

      presence.releaseChannel(CHANNEL_ID);
      presence.take(third);

      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS * 2);

      expect(cancellations).toEqual([]);
      expect(presence.claimOf(CHANNEL_ID)?.sessionId).toBe(third.sessionId);
    });

    it('fires nothing at the old deadline once the swap has completed', async () => {
      const { registry, cancellations } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');
      registry.produced(waiter);
      registry.complete(CHANNEL_ID);

      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS * 2);

      expect(cancellations).toEqual([]);
    });

    it('keeps the deadline armed for a produce by a session that was not granted', async () => {
      const { registry, cancellations } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      expect(registry.produced(third)).toBe(false);

      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS);

      expect(cancellations).toHaveLength(1);
    });
  });

  describe('socket departure', () => {
    it("cancels a pending request when the waiter's socket disconnects", () => {
      const { registry, published } = live();
      registry.request(waiter);
      published.length = 0;

      registry.releaseSocket(waiter.socketId);

      expect(registry.view(CHANNEL_ID)?.request ?? null).toBeNull();
      expect(typesOf(published)).toEqual(['handover-changed']);
    });

    it('leaves a request alone when an unrelated socket disconnects', () => {
      const { registry } = live();
      registry.request(waiter);

      registry.releaseSocket(holder.socketId);
      registry.releaseSocket('socket-unknown');

      expect(registry.view(CHANNEL_ID)?.request?.sessionId).toBe(waiter.sessionId);
    });
  });

  describe('forgetChannel and close', () => {
    it('disarms a pending request timer and publishes the change', async () => {
      const { registry, published } = live();
      registry.request(waiter);
      published.length = 0;

      registry.forgetChannel(CHANNEL_ID);

      expect(registry.view(CHANNEL_ID)).toBeNull();
      expect(typesOf(published)).toEqual(['handover-changed']);

      await vi.advanceTimersByTimeAsync(TAKEOVER_AFTER_MS);

      expect(typesOf(published)).toEqual(['handover-changed']);
    });

    it('disarms a grant timer without asking media to close anything', async () => {
      const { registry, cancellations } = live();
      registry.request(waiter);
      registry.confirm(holder, 'producer-out');

      registry.forgetChannel(CHANNEL_ID);
      await vi.advanceTimersByTimeAsync(GRANT_DEADLINE_MS);

      expect(cancellations).toEqual([]);
    });

    it('publishes nothing for a channel that had no handover', () => {
      const { registry, published } = live();

      registry.forgetChannel(CHANNEL_ID);

      expect(published).toEqual([]);
    });

    it('drops every timer on close', async () => {
      const { registry, published, cancellations } = live();
      registry.request(waiter);
      published.length = 0;

      registry.close();
      await vi.advanceTimersByTimeAsync(TAKEOVER_AFTER_MS + GRANT_DEADLINE_MS);

      expect(published).toEqual([]);
      expect(cancellations).toEqual([]);
    });
  });
});
