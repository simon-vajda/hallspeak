/**
 * Which channels have a live speaker.
 *
 * In memory rather than in SQLite on purpose: a boolean column drifts from reality on
 * any crash or restart and then needs reconciliation logic to repair a fact the socket
 * layer already knows for free. Memory is authoritative precisely because it cannot go
 * stale, and a single-process deployment is what makes that sound (spec E §7).
 */
export class PresenceRegistry {
  private readonly speakerByChannel = new Map<number, string>();
  private readonly channelBySocket = new Map<string, number>();

  /**
   * PLACEHOLDER — must be replaced by mediasoup transport state.
   *
   * "Online" has to mean the audio is actually flowing. A connected socket proves only
   * that a browser tab is open, so a speaker whose media negotiation fails still reads
   * as online here. The UI, the event-room broadcast and the client subscription are
   * all real and survive the swap; only this signal is provisional (spec E §1, §7).
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
    // Guarded: a late release from a socket that lost the channel to a successor must
    // not evict the successor.
    if (this.speakerByChannel.get(channelId) === socketId) {
      this.speakerByChannel.delete(channelId);
      return channelId;
    }
    return null;
  }
}

export const presence = new PresenceRegistry();
