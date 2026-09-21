import { LISTENER_HISTORY_WINDOW_MS, type ListenerHistoryPoint } from '@hallspeak/contract/socket';
import { presence } from './presence';

interface StoredPoint {
  at: number;
  count: number;
}

interface ChannelHistory {
  /** The claim start this series belongs to; a different one is a different broadcast. */
  startedAt: number;
  points: StoredPoint[];
}

export interface ListenerHistoryRegistryOptions {
  now?: () => number;
  windowMs?: number;
  claimStartedAt?: (channelId: number) => number | undefined;
}

const keyOf = (eventId: number, channelId: number) => `${eventId}:${channelId}`;

/**
 * How a channel's audience grew and shrank over the current broadcast, in process memory
 * like `PresenceRegistry` and `ReportRegistry`. A stored series would be a record about an
 * audience that has no account, and a restart losing it costs nothing: the chart describes
 * the broadcast in progress.
 *
 * A point is appended only when the coalesced count changes, so an idle channel costs
 * nothing and the series is exact rather than sampled.
 *
 * The series belongs to the claim's `startedAt` rather than to a producer: a producer closes
 * on every speaker reconnect, which would wipe the chart during a blip, while the claim
 * survives reconnects, negotiated handovers and take-overs. A missing claim is not an end —
 * a holder dropping while a colleague waits empties it for the moment the handover completes
 * with the same start — so it records into the series unchanged.
 */
export class ListenerHistoryRegistry {
  private readonly channels = new Map<string, ChannelHistory>();
  private readonly now: () => number;
  private readonly windowMs: number;
  private readonly claimStartedAt: (channelId: number) => number | undefined;

  constructor(options: ListenerHistoryRegistryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.windowMs = options.windowMs ?? LISTENER_HISTORY_WINDOW_MS;
    this.claimStartedAt =
      options.claimStartedAt ?? ((channelId) => presence.claimOf(channelId)?.startedAt);
  }

  /** A coalesced listener count for the channel, kept only where it differs from the last. */
  record(eventId: number, channelId: number, count: number): void {
    const history = this.resolve(eventId, channelId);
    if (!history) {
      return;
    }
    const now = this.now();
    if (history.points.at(-1)?.count !== count) {
      history.points.push({ at: now, count });
    }
    this.prune(history, now);
  }

  /**
   * The windowed series for the claim holder, oldest first, ending at the live count so a
   * studio seeded between recounts is never behind. Undefined when the channel has no
   * broadcast to describe.
   */
  snapshot(
    eventId: number,
    channelId: number,
    liveCount: number,
  ): ListenerHistoryPoint[] | undefined {
    const history = this.resolve(eventId, channelId);
    if (!history) {
      return undefined;
    }
    const now = this.now();
    this.prune(history, now);

    const points = history.points.map((point) => ({
      count: point.count,
      ageMs: Math.max(0, now - point.at),
    }));
    if (points.at(-1)?.count !== liveCount) {
      points.push({ count: liveCount, ageMs: 0 });
    }
    return points;
  }

  /** The broadcast ended, or the channel was revoked: the next one starts from nothing. */
  forgetChannel(eventId: number, channelId: number): void {
    this.channels.delete(keyOf(eventId, channelId));
  }

  /** The event's room is torn down, so every channel under it forgets. */
  forgetEvent(eventId: number): void {
    const prefix = `${eventId}:`;
    for (const key of this.channels.keys()) {
      if (key.startsWith(prefix)) {
        this.channels.delete(key);
      }
    }
  }

  /** Shutdown: nothing remembered, nothing published — this history has no event of its own. */
  close(): void {
    this.channels.clear();
  }

  /**
   * The series this channel is currently writing, seeded or reset against the claim. A
   * seeded series starts at zero: listening is structurally zero before a channel is live.
   */
  private resolve(eventId: number, channelId: number): ChannelHistory | undefined {
    const key = keyOf(eventId, channelId);
    const history = this.channels.get(key);
    const startedAt = this.claimStartedAt(channelId);

    if (startedAt === undefined) {
      return history;
    }
    if (history && history.startedAt === startedAt) {
      return history;
    }
    const seeded: ChannelHistory = { startedAt, points: [{ at: startedAt, count: 0 }] };
    this.channels.set(key, seeded);
    return seeded;
  }

  /**
   * Older points go, except the newest of them: the line has to reach the window's left
   * edge, and the count before the window is what it was at that edge.
   */
  private prune(history: ChannelHistory, now: number): void {
    const cutoff = now - this.windowMs;
    const firstInside = history.points.findIndex((point) => point.at >= cutoff);
    const from =
      firstInside === -1 ? Math.max(0, history.points.length - 1) : Math.max(0, firstInside - 1);
    if (from > 0) {
      history.points = history.points.slice(from);
    }
  }
}

export const listenerHistory = new ListenerHistoryRegistry();
