import type { types } from 'mediasoup';
import { AppError } from '../../lib/problem';
import { Peer, type TransportDirection } from './peer';

function slugOf(producer: types.Producer): string {
  const slug = (producer.appData as { slug?: unknown }).slug;
  return typeof slug === 'string' ? slug : '';
}

export interface RoomInit {
  eventId: number;
  router: types.Router;
  webRtcServer: types.WebRtcServer;
  workerIndex: number;
}

/**
 * One event's media: a single router, its producers keyed by channel, and a peer per
 * connected socket. One router per event and not per channel, because a transport can only
 * consume producers on its own router — a guest holding one connection for the whole event
 * is what makes switching language instant.
 */
export class Room {
  readonly eventId: number;
  readonly router: types.Router;
  readonly webRtcServer: types.WebRtcServer;
  readonly workerIndex: number;

  private readonly producers = new Map<number, types.Producer>();
  private readonly peers = new Map<string, Peer>();
  private closed = false;

  constructor(init: RoomInit) {
    this.eventId = init.eventId;
    this.router = init.router;
    this.webRtcServer = init.webRtcServer;
    this.workerIndex = init.workerIndex;
  }

  // --- producers --------------------------------------------------------------

  get producerCount(): number {
    return this.producers.size;
  }

  producer(channelId: number): types.Producer | undefined {
    return this.producers.get(channelId);
  }

  /** A channel is live while an unclosed producer exists. Mute pauses; it does not close. */
  isOnline(channelId: number): boolean {
    const producer = this.producers.get(channelId);
    return producer !== undefined && !producer.closed;
  }

  /** Producing twice on one channel replaces rather than duplicating. */
  setProducer(channelId: number, producer: types.Producer): void {
    this.producers.get(channelId)?.close();
    this.producers.set(channelId, producer);
    producer.observer.once('close', () => {
      if (this.producers.get(channelId) === producer) this.producers.delete(channelId);
    });
  }

  closeProducer(channelId: number): void {
    const producer = this.producers.get(channelId);
    if (!producer) return;
    this.producers.delete(channelId);
    producer.close();
  }

  liveChannelIds(): number[] {
    return [...this.producers.keys()];
  }

  /** Each live channel with the slug its producer was stamped with at produce time. */
  liveChannels(): Array<{ channelId: number; slug: string }> {
    return [...this.producers.entries()].map(([channelId, producer]) => ({
      channelId,
      slug: slugOf(producer),
    }));
  }

  producerSlug(channelId: number): string | undefined {
    const producer = this.producers.get(channelId);
    return producer === undefined ? undefined : slugOf(producer);
  }

  /**
   * How many guests are actually receiving this channel: peers holding an open, locally
   * unpaused consumer on its producer. Structurally zero until somebody goes live, and
   * zero again the moment the producer closes, because mediasoup closes its consumers.
   */
  listenerCount(channelId: number): number {
    const producer = this.producers.get(channelId);
    if (!producer || producer.closed) return 0;
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.isListeningTo(producer.id)) count += 1;
    }
    return count;
  }

  // --- peers ------------------------------------------------------------------

  /** The lookup the takeover and revocation paths both need; unknown is undefined. */
  peer(socketId: string): Peer | undefined {
    return this.peers.get(socketId);
  }

  peerFor(socketId: string): Peer {
    const existing = this.peers.get(socketId);
    if (existing) return existing;
    const peer = new Peer(socketId);
    this.peers.set(socketId, peer);
    return peer;
  }

  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  closePeer(socketId: string): void {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    this.peers.delete(socketId);
    peer.close();
  }

  // --- transports -------------------------------------------------------------

  /**
   * Allocation failure is an `AppError` with its own code, so a client sees a real
   * rejection rather than the 8s handler timeout or a generic internal error.
   */
  async createTransport(
    socketId: string,
    direction: TransportDirection,
  ): Promise<types.WebRtcTransport> {
    const peer = this.peerFor(socketId);
    if (peer.transport(direction)) {
      throw new AppError('transport_exists', `A ${direction} transport already exists.`);
    }

    let transport: types.WebRtcTransport;
    try {
      transport = await this.router.createWebRtcTransport({
        webRtcServer: this.webRtcServer,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        appData: { socketId, direction },
      });
    } catch (cause) {
      console.error(
        `media: could not create a ${direction} transport on event ${this.eventId}`,
        cause,
      );
      throw new AppError('media_unavailable', 'Could not allocate a media transport.');
    }

    // Registering after the await, so an allocation failure leaves nothing half-attached.
    // The peer can still refuse it — it raced another create — and an unregistered
    // transport is one nothing will ever name again, so it closes here or it leaks.
    try {
      peer.addTransport(direction, transport);
    } catch (cause) {
      transport.close();
      throw cause;
    }
    return transport;
  }

  // --- lifetime ---------------------------------------------------------------

  /** No producers and nothing attached: the state the idle teardown timer waits for. */
  get isIdle(): boolean {
    if (this.producers.size > 0) return false;
    for (const peer of this.peers.values()) {
      if (peer.transportCount > 0) return false;
    }
    return true;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const producer of this.producers.values()) producer.close();
    this.producers.clear();
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
    this.router.close();
  }
}
