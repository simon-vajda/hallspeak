interface Claim {
  speakerCode: string;
  socketId: string;
}

/** `displaced` names the socket that just lost the channel, so its media can be closed. */
export type ClaimResult = { ok: true; displaced: string | null } | { ok: false };

/**
 * Who may broadcast on which channel. In memory rather than in SQLite: a boolean column
 * drifts from reality on any crash and then needs reconciliation to repair a fact the
 * socket layer already knows. Sound only because the deployment is one process.
 *
 * The claim is broadcast rights, not liveness — it is taken when the studio connects,
 * which is before any audio exists and may be long before any is produced. Whether a
 * channel is live is `core/media`'s answer, derived from producer existence.
 */
export class PresenceRegistry {
  private readonly claimByChannel = new Map<number, Claim>();
  private readonly channelBySocket = new Map<string, number>();

  holder(channelId: number): string | undefined {
    return this.claimByChannel.get(channelId)?.socketId;
  }

  /**
   * Keyed on the speaker code, not the socket id. A reconnecting interpreter races their
   * own dying socket, which lives for up to the ten-second ping window; keyed on the
   * socket they would be refused their own channel for that long. The cost is that two
   * devices holding one link take the channel from each other, which is why the loser is
   * told rather than left to reclaim it.
   */
  claim(channelId: number, speakerCode: string, socketId: string): ClaimResult {
    const held = this.claimByChannel.get(channelId);
    if (held && held.speakerCode !== speakerCode) {
      return { ok: false };
    }

    this.claimByChannel.set(channelId, { speakerCode, socketId });
    this.channelBySocket.set(socketId, channelId);

    if (!held || held.socketId === socketId) {
      return { ok: true, displaced: null };
    }

    console.log(
      `presence: channel ${channelId} taken over by ${socketId}, displacing ${held.socketId}`,
    );
    return { ok: true, displaced: held.socketId };
  }

  /** The channel this socket just gave up, or null if it held none. */
  release(socketId: string): number | null {
    const channelId = this.channelBySocket.get(socketId);
    if (channelId === undefined) {
      return null;
    }
    this.channelBySocket.delete(socketId);
    // A late release from a socket that lost the channel must not evict its successor.
    if (this.claimByChannel.get(channelId)?.socketId === socketId) {
      this.claimByChannel.delete(channelId);
      return channelId;
    }
    return null;
  }

  /** Drops a claim from the channel's side, for admin revocation; names who held it. */
  releaseChannel(channelId: number): string | null {
    const held = this.claimByChannel.get(channelId);
    if (!held) {
      return null;
    }
    this.claimByChannel.delete(channelId);
    this.channelBySocket.delete(held.socketId);
    return held.socketId;
  }
}

export const presence = new PresenceRegistry();
