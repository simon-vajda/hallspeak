import { type Notification, notifications } from './notifications';
import { type ClaimHolder, presence, type StudioSocket } from './presence';

/**
 * How long the live interpreter has before the waiting one may force the swap. Long enough
 * to finish a sentence, short enough that a studio nobody is sitting at cannot hold the
 * channel for the rest of the event.
 */
export const TAKEOVER_AFTER_MS = 30_000;

/** How long a granted studio has to start producing before the grant is cancelled. */
export const GRANT_DEADLINE_MS = 10_000;

export interface ChannelRef {
  eventId: number;
  channelId: number;
}

/** The waiting studio, and the moment it may stop waiting. */
export interface PendingRequest {
  sessionId: string;
  socketId: string;
  requestedAt: number;
  takeOverAt: number;
}

/** Permission to produce, held by one session until the swap completes or is cancelled. */
export interface Grant {
  sessionId: string;
  socketId: string;
  /** Who was live when the grant was made; null when the channel was already free. */
  fromSessionId: string | null;
  fromSocketId: string | null;
  /** The producer standing at grant time, which keeps the claim if the grant is cancelled. */
  producerId: string | null;
  grantedAt: number;
  /** Null once the granted studio has produced: the swap window has its own deadline. */
  deadlineAt: number | null;
}

export interface ChannelHandover {
  request: PendingRequest | null;
  grant: Grant | null;
}

export type RequestResult = 'accepted' | 'no_claim' | 'holds_claim' | 'in_progress';
export type CancelResult = 'accepted' | 'not_waiting';
export type ConfirmResult = 'accepted' | 'not_holder' | 'nothing_pending';
export type TakeOverResult = 'accepted' | 'not_waiting' | 'too_soon';

/** A grant that ended without a swap. The recorded producer is what stood when it was made. */
export interface GrantCancellation extends ChannelRef {
  sessionId: string;
  socketId: string;
  producerId: string | null;
}

export type GrantCancelListener = (cancellation: GrantCancellation) => void;

/** The half of `PresenceRegistry` this registry uses, so a test can hand it a plain double. */
export interface ClaimRegistry {
  claimOf(channelId: number): ClaimHolder | undefined;
  move(studio: StudioSocket): string | null;
}

export interface HandoverRegistryOptions {
  publish?: (notification: Notification) => void;
  now?: () => number;
  presence?: ClaimRegistry;
  takeOverAfterMs?: number;
  grantDeadlineMs?: number;
}

interface ChannelState extends ChannelHandover {
  eventId: number;
  timer?: NodeJS.Timeout;
}

/**
 * At most one handover in progress per channel: a request, then a grant, then nothing.
 * Process memory beside presence, for the reason presence is — the facts describe live
 * connections, and a stored one would be wrong the moment the process restarts.
 *
 * Every operation derives its authority from the caller's own session and never from a
 * payload (`docs/solutions/conventions/an-identifier-returned-to-a-client-is-not-a-capability.md`),
 * and every deadline is the server's: a client only ever displays the remaining duration.
 */
export class HandoverRegistry {
  private readonly channels = new Map<number, ChannelState>();
  private readonly cancelListeners = new Set<GrantCancelListener>();
  private readonly publisher: (notification: Notification) => void;
  private readonly now: () => number;
  private readonly claims: ClaimRegistry;
  private readonly takeOverAfterMs: number;
  private readonly grantDeadlineMs: number;

  constructor(options: HandoverRegistryOptions = {}) {
    this.publisher = options.publish ?? ((n) => notifications.publish(n));
    this.now = options.now ?? (() => Date.now());
    this.claims = options.presence ?? presence;
    this.takeOverAfterMs = options.takeOverAfterMs ?? TAKEOVER_AFTER_MS;
    this.grantDeadlineMs = options.grantDeadlineMs ?? GRANT_DEADLINE_MS;
  }

  /**
   * Where the media layer attaches, in the shape of `AnnouncedAddress.onChange`: a cancelled
   * grant has to close a producer, and `core/media` already imports presence — so the
   * dependency points this way rather than closing the cycle.
   */
  onGrantCancelled(listener: GrantCancelListener): () => void {
    this.cancelListeners.add(listener);
    return () => {
      this.cancelListeners.delete(listener);
    };
  }

  /** What is in flight on the channel, or null when nothing is. */
  view(channelId: number): ChannelHandover | null {
    const state = this.channels.get(channelId);
    if (!state || (!state.request && !state.grant)) {
      return null;
    }
    return { request: state.request, grant: state.grant };
  }

  /** The countdown a studio displays, anchored at receipt rather than sent as a timestamp. */
  remainingMs(channelId: number): number | null {
    const state = this.channels.get(channelId);
    const deadline = state?.grant ? state.grant.deadlineAt : (state?.request?.takeOverAt ?? null);
    return deadline === null || deadline === undefined ? null : Math.max(0, deadline - this.now());
  }

  /** The server's answer, never the client's arithmetic. */
  canTakeOver(channelId: number, sessionId: string): boolean {
    const state = this.channels.get(channelId);
    if (!state?.request || state.grant) {
      return false;
    }
    return state.request.sessionId === sessionId && this.now() >= state.request.takeOverAt;
  }

  /** A studio in pre-flight asking the live interpreter to hand the channel over. */
  request(caller: StudioSocket): RequestResult {
    const existing = this.channels.get(caller.channelId);
    if (existing?.request || existing?.grant) {
      return 'in_progress';
    }

    const claim = this.claims.claimOf(caller.channelId);
    if (!claim) {
      return 'no_claim';
    }
    if (claim.sessionId === caller.sessionId) {
      return 'holds_claim';
    }

    // Only now, so a channel that has only ever refused requests keeps no entry at all.
    const state = this.stateOf(caller);
    const requestedAt = this.now();
    state.request = {
      sessionId: caller.sessionId,
      socketId: caller.socketId,
      requestedAt,
      takeOverAt: requestedAt + this.takeOverAfterMs,
    };
    // The take-over deadline is published rather than merely enforced: without it a studio
    // that sat through the countdown would hold a snapshot saying it still may not force.
    this.arm(caller.channelId, state, state.request.takeOverAt, () => {
      this.publishChanged(caller.channelId, state.eventId);
    });
    this.publishChanged(caller.channelId, state.eventId);
    return 'accepted';
  }

  /** The waiting studio withdrawing, which clears both prompts. */
  cancel(caller: StudioSocket): CancelResult {
    const state = this.channels.get(caller.channelId);
    if (!state?.request || state.grant || state.request.sessionId !== caller.sessionId) {
      return 'not_waiting';
    }
    state.request = null;
    this.disarm(state);
    this.publishChanged(caller.channelId, state.eventId);
    return 'accepted';
  }

  /** The live interpreter handing over. There is no decline: ignoring it ends in a take-over. */
  confirm(caller: StudioSocket, standingProducerId: string | null): ConfirmResult {
    const state = this.channels.get(caller.channelId);
    if (!state?.request || state.grant) {
      return 'nothing_pending';
    }
    if (this.claims.claimOf(caller.channelId)?.sessionId !== caller.sessionId) {
      return 'not_holder';
    }
    this.grant(caller.channelId, state, standingProducerId);
    return 'accepted';
  }

  /** The waiting studio forcing the swap once the countdown has run out. */
  takeOver(caller: StudioSocket, standingProducerId: string | null): TakeOverResult {
    const state = this.channels.get(caller.channelId);
    if (!state?.request || state.grant || state.request.sessionId !== caller.sessionId) {
      return 'not_waiting';
    }
    if (this.now() < state.request.takeOverAt) {
      return 'too_soon';
    }
    this.grant(caller.channelId, state, standingProducerId);
    return 'accepted';
  }

  /**
   * Every way the live interpreter leaves while someone is waiting: a deliberate end, a
   * closed page, a dropped network. All of them hand the channel over rather than ending
   * the broadcast, which is why this is one hook and not three.
   */
  departed(channel: ChannelRef, standingProducerId: string | null): Grant | null {
    const state = this.channels.get(channel.channelId);
    if (!state?.request || state.grant) {
      return null;
    }
    return this.grant(channel.channelId, state, standingProducerId);
  }

  /** The granted studio's produce landed, so the grant deadline no longer binds. */
  produced(caller: StudioSocket): boolean {
    const state = this.channels.get(caller.channelId);
    if (!state?.grant || state.grant.sessionId !== caller.sessionId) {
      return false;
    }
    state.grant.deadlineAt = null;
    this.disarm(state);
    this.publishChanged(caller.channelId, state.eventId);
    return true;
  }

  /**
   * Promotion: the swap window closed, so the claim moves to the granted session. This is
   * the only place a claim moves between sessions, and it is deliberately not grant time —
   * a grant is permission to produce, and a grant that never produces must leave the
   * outgoing interpreter exactly as live as they were.
   */
  complete(channelId: number): boolean {
    const state = this.channels.get(channelId);
    if (!state?.grant) {
      return false;
    }
    const { sessionId, socketId } = state.grant;
    state.grant = null;
    this.disarm(state);
    this.claims.move({ eventId: state.eventId, channelId, sessionId, socketId });
    this.publishChanged(channelId, state.eventId);
    return true;
  }

  /** A socket is gone: it can neither wait nor go live, whichever it was doing. */
  releaseSocket(socketId: string): void {
    for (const [channelId, state] of this.channels) {
      if (state.grant?.socketId === socketId) {
        this.cancelGrant(channelId, state);
        continue;
      }
      if (state.request?.socketId === socketId) {
        state.request = null;
        this.disarm(state);
        this.publishChanged(channelId, state.eventId);
      }
    }
  }

  /**
   * Revocation: every studio on the channel is being disconnected, so nothing is in flight
   * and no producer is left for the media layer to reason about.
   */
  forgetChannel(channelId: number): void {
    const state = this.channels.get(channelId);
    if (!state) {
      return;
    }
    this.channels.delete(channelId);
    this.disarm(state);
    if (state.request || state.grant) {
      this.publishChanged(channelId, state.eventId);
    }
  }

  /** Shutdown: every timer dropped, nothing published, nothing remembered. */
  close(): void {
    for (const state of this.channels.values()) {
      this.disarm(state);
    }
    this.channels.clear();
    this.cancelListeners.clear();
  }

  private stateOf(channel: ChannelRef): ChannelState {
    const existing = this.channels.get(channel.channelId);
    if (existing) {
      existing.eventId = channel.eventId;
      return existing;
    }
    const state: ChannelState = { eventId: channel.eventId, request: null, grant: null };
    this.channels.set(channel.channelId, state);
    return state;
  }

  private grant(
    channelId: number,
    state: ChannelState,
    standingProducerId: string | null,
  ): Grant | null {
    const request = state.request;
    if (!request) {
      return null;
    }
    const claim = this.claims.claimOf(channelId);
    const grantedAt = this.now();
    const deadlineAt = grantedAt + this.grantDeadlineMs;
    const grant: Grant = {
      sessionId: request.sessionId,
      socketId: request.socketId,
      fromSessionId: claim?.sessionId ?? null,
      fromSocketId: claim?.socketId ?? null,
      producerId: standingProducerId,
      grantedAt,
      deadlineAt,
    };
    state.request = null;
    state.grant = grant;
    this.arm(channelId, state, deadlineAt, () => {
      this.cancelGrant(channelId, state);
    });

    this.publisher({
      type: 'handover-granted',
      eventId: state.eventId,
      channelId,
      fromSessionId: grant.fromSessionId,
      toSessionId: grant.sessionId,
    });
    this.publishChanged(channelId, state.eventId);
    return grant;
  }

  /**
   * The grant ends with no swap. The media layer is told which producer stood when it was
   * made: that producer keeps the claim, so an interpreter who is still live simply stays
   * live, and one who has already stopped is closed rather than handed the channel back.
   */
  private cancelGrant(channelId: number, state: ChannelState): void {
    const grant = state.grant;
    if (!grant) {
      return;
    }
    state.grant = null;
    this.disarm(state);
    this.publishChanged(channelId, state.eventId);
    for (const listener of this.cancelListeners) {
      listener({
        eventId: state.eventId,
        channelId,
        sessionId: grant.sessionId,
        socketId: grant.socketId,
        producerId: grant.producerId,
      });
    }
  }

  private publishChanged(channelId: number, eventId: number): void {
    this.publisher({ type: 'handover-changed', eventId, channelId });
  }

  private arm(channelId: number, state: ChannelState, deadlineAt: number, fire: () => void): void {
    this.disarm(state);
    const timer = setTimeout(
      () => {
        state.timer = undefined;
        if (this.channels.get(channelId) === state) {
          fire();
        }
      },
      Math.max(0, deadlineAt - this.now()),
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

export const handover = new HandoverRegistry();
