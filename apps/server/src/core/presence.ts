import { type Notification, notifications } from './notifications';

/** A studio page connected to a channel: one per socket, several per session over time. */
export interface StudioSocket {
  eventId: number;
  channelId: number;
  sessionId: string;
  socketId: string;
}

/** Who holds broadcast rights on a channel, and over which connection right now. */
export interface ClaimHolder {
  sessionId: string;
  socketId: string;
}

export interface PresenceRegistryOptions {
  publish?: (notification: Notification) => void;
}

interface Claim extends ClaimHolder {
  eventId: number;
}

/**
 * Who may broadcast on which channel. In memory rather than in SQLite: a boolean column
 * drifts from reality on any crash and then needs reconciliation to repair a fact the
 * socket layer already knows. Sound only because the deployment is one process.
 *
 * The claim is broadcast rights, not liveness — it is taken when a studio goes live, and
 * kept through a mute and through a lost connection the same studio comes back on.
 * Whether a channel is live is `core/media`'s answer, derived from producer existence.
 */
export class PresenceRegistry {
  private readonly claimByChannel = new Map<number, Claim>();
  private readonly studiosByChannel = new Map<number, Map<string, StudioSocket>>();
  private readonly studioBySocket = new Map<string, StudioSocket>();
  private readonly publisher: (notification: Notification) => void;

  constructor(options: PresenceRegistryOptions = {}) {
    this.publisher = options.publish ?? ((n) => notifications.publish(n));
  }

  holder(channelId: number): string | undefined {
    return this.claimByChannel.get(channelId)?.socketId;
  }

  claimOf(channelId: number): ClaimHolder | undefined {
    const claim = this.claimByChannel.get(channelId);
    return claim && { sessionId: claim.sessionId, socketId: claim.socketId };
  }

  /** Every studio currently connected to the channel, holder or not. */
  studios(channelId: number): StudioSocket[] {
    return [...(this.studiosByChannel.get(channelId)?.values() ?? [])];
  }

  /**
   * A studio arriving on the channel. Opening one is not a request to broadcast, so it
   * takes nothing — but a session that already holds the claim is the same studio coming
   * back on a fresh connection, and the claim follows it there. Keyed on the session
   * rather than the socket so an interpreter does not race their own dying socket, which
   * lives for up to the ten-second ping window.
   */
  registerStudio(studio: StudioSocket): void {
    const { channelId, socketId } = studio;
    let channelStudios = this.studiosByChannel.get(channelId);
    if (!channelStudios) {
      channelStudios = new Map();
      this.studiosByChannel.set(channelId, channelStudios);
    }
    channelStudios.set(socketId, studio);
    this.studioBySocket.set(socketId, studio);

    const held = this.claimByChannel.get(channelId);
    if (held && held.sessionId === studio.sessionId && held.socketId !== socketId) {
      this.setClaim(studio);
    }
  }

  /** Going live. Refused while another session holds the channel; the caller stays connected. */
  take(studio: StudioSocket): boolean {
    this.registerStudio(studio);

    const held = this.claimByChannel.get(studio.channelId);
    if (held && held.sessionId !== studio.sessionId) {
      return false;
    }
    if (held && held.socketId === studio.socketId) {
      return true;
    }
    this.setClaim(studio);
    return true;
  }

  /**
   * Hands the channel to another session regardless of who holds it — a granted handover,
   * never a race. Names the socket that held it, which has not been disconnected.
   */
  move(studio: StudioSocket): string | null {
    this.registerStudio(studio);

    const previous = this.claimByChannel.get(studio.channelId)?.socketId ?? null;
    this.setClaim(studio);
    return previous === studio.socketId ? null : previous;
  }

  /**
   * The channel this socket just gave up, or null if it held none. A release from a socket
   * the same studio has already replaced frees nothing, which is what makes a reconnect and
   * a drop safe to arrive in either order.
   */
  release(socketId: string): number | null {
    const studio = this.studioBySocket.get(socketId);
    if (!studio) {
      return null;
    }
    this.studioBySocket.delete(socketId);

    const channelStudios = this.studiosByChannel.get(studio.channelId);
    channelStudios?.delete(socketId);
    if (channelStudios?.size === 0) {
      this.studiosByChannel.delete(studio.channelId);
    }

    if (this.claimByChannel.get(studio.channelId)?.socketId !== socketId) {
      return null;
    }
    this.dropClaim(studio.channelId);
    return studio.channelId;
  }

  /**
   * Drops a claim from the channel's side — a deliberate end, or admin revocation. The
   * studios stay connected: ending a broadcast is not leaving the channel.
   */
  releaseChannel(channelId: number): string | null {
    const held = this.claimByChannel.get(channelId);
    if (!held) {
      return null;
    }
    this.dropClaim(channelId);
    return held.socketId;
  }

  private setClaim(studio: StudioSocket): void {
    const { eventId, channelId, sessionId, socketId } = studio;
    this.claimByChannel.set(channelId, { eventId, sessionId, socketId });
    this.publisher({ type: 'claim-changed', eventId, channelId, sessionId, socketId });
  }

  private dropClaim(channelId: number): void {
    const held = this.claimByChannel.get(channelId);
    if (!held) {
      return;
    }
    this.claimByChannel.delete(channelId);
    this.publisher({
      type: 'claim-changed',
      eventId: held.eventId,
      channelId,
      sessionId: null,
      socketId: null,
    });
  }
}

export const presence = new PresenceRegistry();
