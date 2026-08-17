/**
 * Which channels have a live speaker. In memory rather than in SQLite: a boolean column
 * drifts from reality on any crash and then needs reconciliation to repair a fact the
 * socket layer already knows. Sound only because the deployment is one process.
 */
export class PresenceRegistry {
  private readonly speakerByChannel = new Map<number, string>();
  private readonly channelBySocket = new Map<string, number>();

  /**
   * PLACEHOLDER: must be replaced by mediasoup transport state. This currently means "a
   * socket is connected", not "audio is flowing".
   */
  isOnline(channelId: number): boolean {
    return this.speakerByChannel.has(channelId);
  }

  /** First connection wins. `false` means the channel already has a live speaker. */
  claim(channelId: number, socketId: string): boolean {
    if (this.speakerByChannel.has(channelId)) return false;
    this.speakerByChannel.set(channelId, socketId);
    this.channelBySocket.set(socketId, channelId);
    return true;
  }

  /** The channel that just went offline, or null if this socket held none. */
  release(socketId: string): number | null {
    const channelId = this.channelBySocket.get(socketId);
    if (channelId === undefined) return null;
    this.channelBySocket.delete(socketId);
    // A late release from a socket that lost the channel must not evict its successor.
    if (this.speakerByChannel.get(channelId) === socketId) {
      this.speakerByChannel.delete(channelId);
      return channelId;
    }
    return null;
  }
}

export const presence = new PresenceRegistry();
