import { type Notification, notifications } from '../notifications';

/**
 * Long enough that a room emptying or filling settles into one notification, short enough
 * that a studio's number never looks stale to the interpreter watching it.
 */
export const LISTENER_COUNT_WINDOW_MS = 300;

export interface ListenerCountPublisherOptions {
  /** A recount, not a delta. A missing room answers zero rather than not answering. */
  count: (eventId: number, channelId: number) => number;
  publish?: (notification: Notification) => void;
  windowMs?: number;
}

interface Pending {
  timer: NodeJS.Timeout;
  slug: string;
}

interface Published {
  count: number;
  slug: string;
}

const keyOf = (eventId: number, channelId: number) => `${eventId}:${channelId}`;

/**
 * Turns a stream of "something may have changed" pokes into a `listeners-changed` fact.
 *
 * Every arrival, departure, language switch, disconnect, eviction and producer close
 * pokes it, so it coalesces on a trailing window and publishes only when the recomputed
 * number differs from the one it last published. That remembered number is why
 * `forgetEvent` exists: left behind after a room is torn down, it would suppress the
 * first real count of the next broadcast on that channel — a studio reading zero through
 * a whole service while people listen.
 */
export class ListenerCountPublisher {
  private readonly pending = new Map<string, Pending>();
  private readonly published = new Map<string, Published>();
  private readonly count: (eventId: number, channelId: number) => number;
  private readonly publisher: (notification: Notification) => void;
  private readonly windowMs: number;

  constructor(options: ListenerCountPublisherOptions) {
    this.count = options.count;
    this.publisher = options.publish ?? ((n) => notifications.publish(n));
    this.windowMs = options.windowMs ?? LISTENER_COUNT_WINDOW_MS;
  }

  /** Trailing: the first poke arms the window, later ones inside it only refresh the slug. */
  schedule(eventId: number, channelId: number, slug: string): void {
    const key = keyOf(eventId, channelId);
    const existing = this.pending.get(key);
    if (existing) {
      existing.slug = slug;
      return;
    }
    const timer = setTimeout(() => {
      const entry = this.pending.get(key);
      this.pending.delete(key);
      this.flush(eventId, channelId, entry?.slug ?? slug);
    }, this.windowMs);
    timer.unref?.();
    this.pending.set(key, { timer, slug });
  }

  /**
   * The room is gone: publish the zero nobody will recount, drop the window, and forget.
   * Called from the room-closed hook, where the room has already closed and can no longer
   * name its own channels — which is why the slug comes from here rather than the room.
   */
  forgetEvent(eventId: number): void {
    const prefix = `${eventId}:`;
    for (const [key, entry] of [...this.pending]) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      clearTimeout(entry.timer);
      this.pending.delete(key);
    }
    for (const [key, entry] of [...this.published]) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      this.published.delete(key);
      if (entry.count === 0) {
        continue;
      }
      const channelId = Number(key.slice(prefix.length));
      this.publisher({
        type: 'listeners-changed',
        eventId,
        channelId,
        slug: entry.slug,
        count: 0,
      });
    }
  }

  /** Shutdown: every window dropped, nothing published, nothing remembered. */
  close(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();
    this.published.clear();
  }

  private flush(eventId: number, channelId: number, slug: string): void {
    const key = keyOf(eventId, channelId);
    // A recount, never a delta, and a room that has gone away answers zero: the window is
    // trailing, so it routinely fires after the room it names was torn down.
    const count = this.count(eventId, channelId);
    // Nothing remembered means zero, not "unknown": every channel starts with no
    // listeners, so a first recount of zero is not a change worth a notification.
    const previous = this.published.get(key)?.count ?? 0;
    if (previous === count) {
      return;
    }
    this.published.set(key, { count, slug });
    this.publisher({ type: 'listeners-changed', eventId, channelId, slug, count });
  }
}
