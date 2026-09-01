import type { ReportCategory, ReportResolution, ReportRow } from '@linguacast/contract/socket';
import { type Notification, notifications } from './notifications';

/** How long a report counts for. Past it the interpreter is looking at a session log. */
export const REPORT_WINDOW_MS = 5 * 60 * 1000;

/** Positive follow-up is an acknowledgement, not ongoing state. */
export const REPORT_RESOLUTION_WINDOW_MS = 30 * 1000;

/** One connection may report a category once per this span; the sheet mirrors it locally. */
export const REPORT_COOLDOWN_MS = 2 * 60 * 1000;

export type RecordResult = 'accepted' | 'too_soon';
export type ResolveResult = 'accepted' | 'not_open';

export interface ReportSnapshot {
  rows: ReportRow[];
  soundsGood: ReportResolution;
}

interface Entry {
  category: ReportCategory;
  /** False after a positive follow-up; retained only to enforce the original cooldown. */
  active: boolean;
  /** Null once the socket is gone: the report still counts, its cooldown no longer binds. */
  socketId: string | null;
  at: number;
}

interface ChannelState {
  eventId: number;
  slug: string;
  entries: Entry[];
  resolutions: { at: number }[];
  /** Connections that reported a problem and have not yet confirmed recovery. */
  openSockets: Set<string>;
  timer?: NodeJS.Timeout;
}

export interface ReportRegistryOptions {
  publish?: (notification: Notification) => void;
  now?: () => number;
  windowMs?: number;
  resolutionWindowMs?: number;
  cooldownMs?: number;
}

const keyOf = (eventId: number, channelId: number) => `${eventId}:${channelId}`;

/**
 * The rolling per-channel tally of listener reports, in the shape of `PresenceRegistry`:
 * process memory, never SQLite. A report is a live signal for whoever is on air right now,
 * and a stored one would be a record about an audience that has no account.
 *
 * It sits beside `presence.ts` rather than under `core/media/` for the same reason presence
 * does — a report is about a channel, and the registry has to be reachable whether or not a
 * mediasoup room exists.
 */
export class ReportRegistry {
  private readonly channels = new Map<string, ChannelState>();
  private readonly publisher: (notification: Notification) => void;
  private readonly now: () => number;
  private readonly windowMs: number;
  private readonly resolutionWindowMs: number;
  private readonly cooldownMs: number;

  constructor(options: ReportRegistryOptions = {}) {
    this.publisher = options.publish ?? ((n) => notifications.publish(n));
    this.now = options.now ?? (() => Date.now());
    this.windowMs = options.windowMs ?? REPORT_WINDOW_MS;
    this.resolutionWindowMs = options.resolutionWindowMs ?? REPORT_RESOLUTION_WINDOW_MS;
    this.cooldownMs = options.cooldownMs ?? REPORT_COOLDOWN_MS;
  }

  /**
   * The cooldown bounds a connection, not a person: a reload arrives as a new socket and is
   * accepted. An address-keyed rule would silence every listener behind one NAT after the
   * first, and a listener-generated identifier is the identity this product does not have.
   */
  record(
    eventId: number,
    channelId: number,
    slug: string,
    socketId: string,
    category: ReportCategory,
  ): RecordResult {
    const key = keyOf(eventId, channelId);
    const state =
      this.channels.get(key) ??
      ({
        eventId,
        slug,
        entries: [],
        resolutions: [],
        openSockets: new Set(),
      } satisfies ChannelState);
    state.slug = slug;
    this.channels.set(key, state);

    const now = this.now();
    this.prune(state, now);

    const recent = state.entries.find(
      (entry) =>
        entry.socketId === socketId &&
        entry.category === category &&
        now - entry.at < this.cooldownMs,
    );
    if (recent) {
      return 'too_soon';
    }

    state.entries.push({ category, active: true, socketId, at: now });
    state.openSockets.add(socketId);
    this.publish(channelId, state, now);
    this.arm(channelId, state, now);
    return 'accepted';
  }

  /** The current rows, for the tally a studio is sent the moment it connects. */
  tally(eventId: number, channelId: number): ReportRow[] {
    return this.snapshot(eventId, channelId).rows;
  }

  /** Both halves of the current speaker panel, including an empty known snapshot. */
  snapshot(eventId: number, channelId: number): ReportSnapshot {
    const state = this.channels.get(keyOf(eventId, channelId));
    if (!state) {
      return { rows: [], soundsGood: null };
    }
    const now = this.now();
    this.prune(state, now);
    return snapshotOf(state, now);
  }

  /**
   * Closes one connection's reporting episode. Its still-live negative entries disappear;
   * the positive confirmation remains in the same rolling window for the speaker.
   */
  resolve(eventId: number, channelId: number, socketId: string): ResolveResult {
    const state = this.channels.get(keyOf(eventId, channelId));
    if (!state?.openSockets.has(socketId)) {
      return 'not_open';
    }

    const now = this.now();
    this.prune(state, now);
    state.openSockets.delete(socketId);
    for (const entry of state.entries) {
      if (entry.socketId === socketId) {
        entry.active = false;
      }
    }
    state.resolutions.push({ at: now });
    this.publish(channelId, state, now);
    this.arm(channelId, state, now);
    return 'accepted';
  }

  /**
   * A socket is gone, so its cooldown binds nobody. The reports it sent stay in the window:
   * the tally describes what the room reported, not who is still attached.
   */
  releaseSocket(socketId: string): void {
    for (const state of this.channels.values()) {
      state.openSockets.delete(socketId);
      for (const entry of state.entries) {
        if (entry.socketId === socketId) {
          entry.socketId = null;
        }
      }
    }
  }

  /** Revocation: the channel's audience is being disconnected, so its tally means nothing. */
  forgetChannel(eventId: number, channelId: number): void {
    const key = keyOf(eventId, channelId);
    const state = this.channels.get(key);
    if (!state) {
      return;
    }
    this.channels.delete(key);
    this.disarm(state);
    if (state.entries.length > 0 || state.resolutions.length > 0) {
      this.publisher({
        type: 'reports-changed',
        eventId,
        channelId,
        slug: state.slug,
        rows: [],
        soundsGood: null,
      });
    }
  }

  /** The room is torn down: every channel under this event forgets, like the listener count. */
  forgetEvent(eventId: number): void {
    const prefix = `${eventId}:`;
    for (const key of [...this.channels.keys()]) {
      if (key.startsWith(prefix)) {
        this.forgetChannel(eventId, Number(key.slice(prefix.length)));
      }
    }
  }

  /** Shutdown: every timer dropped, nothing published, nothing remembered. */
  close(): void {
    for (const state of this.channels.values()) {
      this.disarm(state);
    }
    this.channels.clear();
  }

  private prune(state: ChannelState, now: number): void {
    state.entries = state.entries.filter((entry) => now - entry.at < this.windowMs);
    state.resolutions = state.resolutions.filter(
      (entry) => now - entry.at < this.resolutionWindowMs,
    );
  }

  private publish(channelId: number, state: ChannelState, now: number): void {
    this.publisher({
      type: 'reports-changed',
      eventId: state.eventId,
      channelId,
      slug: state.slug,
      ...snapshotOf(state, now),
    });
  }

  /**
   * One timer per channel, at the next problem or confirmation expiry. Without it the
   * panel emptying on its own would depend on the client re-deriving both windows from data
   * it holds, which splits each rule across two owners.
   */
  private arm(channelId: number, state: ChannelState, now: number): void {
    this.disarm(state);
    const nextExpiryAt = Math.min(
      (state.entries[0]?.at ?? Number.POSITIVE_INFINITY) + this.windowMs,
      (state.resolutions[0]?.at ?? Number.POSITIVE_INFINITY) + this.resolutionWindowMs,
    );
    if (!Number.isFinite(nextExpiryAt)) {
      return;
    }
    const timer = setTimeout(
      () => {
        state.timer = undefined;
        const at = this.now();
        this.prune(state, at);
        this.publish(channelId, state, at);
        this.arm(channelId, state, at);
      },
      Math.max(0, nextExpiryAt - now),
    );
    timer.unref?.();
    state.timer = timer;
  }

  private disarm(state: ChannelState): void {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  }
}

/**
 * One row per reported category in the order the category was first reported. Severity and
 * recency ordering belongs to the web's `lib/reports.ts`, so the tone table has one home.
 */
function rowsOf(entries: Entry[], now: number): ReportRow[] {
  const rows = new Map<ReportCategory, { count: number; latest: number }>();
  for (const entry of entries) {
    if (!entry.active) {
      continue;
    }
    const row = rows.get(entry.category);
    if (row) {
      row.count += 1;
      row.latest = Math.max(row.latest, entry.at);
    } else {
      rows.set(entry.category, { count: 1, latest: entry.at });
    }
  }
  return [...rows].map(([category, row]) => ({
    category,
    count: row.count,
    ageMs: Math.max(0, now - row.latest),
  }));
}

function snapshotOf(state: ChannelState, now: number): ReportSnapshot {
  const latestResolution = state.resolutions.at(-1);
  return {
    rows: rowsOf(state.entries, now),
    soundsGood:
      latestResolution === undefined
        ? null
        : {
            count: state.resolutions.length,
            ageMs: Math.max(0, now - latestResolution.at),
          },
  };
}

export const reports = new ReportRegistry();
