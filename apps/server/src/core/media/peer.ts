import type { types } from 'mediasoup';
import { AppError } from '../../lib/problem';

export type TransportDirection = 'send' | 'recv';

/**
 * One connected socket's media, closable as a unit — the same discipline the client's
 * capture layer uses, and for the same reason: a partial teardown leaks a transport that
 * nothing will ever name again.
 */
export class Peer {
  private readonly transports = new Map<TransportDirection, types.WebRtcTransport>();
  private readonly consumers = new Map<string, types.Consumer>();
  private closed = false;

  constructor(readonly socketId: string) {}

  get isEmpty(): boolean {
    return this.transports.size === 0 && this.consumers.size === 0;
  }

  get transportCount(): number {
    return this.transports.size;
  }

  transport(direction: TransportDirection): types.WebRtcTransport | undefined {
    return this.transports.get(direction);
  }

  transportById(id: string): types.WebRtcTransport | undefined {
    for (const transport of this.transports.values()) {
      if (transport.id === id) return transport;
    }
    return undefined;
  }

  /**
   * One send and one receive is what the architecture assumes anyway, and the cap is what
   * stops any socket past the handshake allocating transports in a loop — which, given
   * access is possession of a projected PIN, is everyone in the room.
   */
  addTransport(direction: TransportDirection, transport: types.WebRtcTransport): void {
    if (this.closed) {
      throw new AppError('peer_closed', 'This session no longer holds media.');
    }
    if (this.transports.has(direction)) {
      throw new AppError('transport_exists', `A ${direction} transport already exists.`);
    }
    this.transports.set(direction, transport);
  }

  addConsumer(consumer: types.Consumer): void {
    if (this.closed) {
      throw new AppError('peer_closed', 'This session no longer holds media.');
    }
    this.consumers.set(consumer.id, consumer);
    // mediasoup closes a consumer on its own when its producer closes, so a client that
    // never calls close would otherwise leave a dead reference here for the whole
    // connection — and a later resume would reach it and throw an untyped error.
    consumer.observer.once('close', () => {
      if (this.consumers.get(consumer.id) === consumer) this.consumers.delete(consumer.id);
    });
  }

  consumerById(id: string): types.Consumer | undefined {
    return this.consumers.get(id);
  }

  /** Unknown is a no-op: a client racing its own close must not get an error for it. */
  closeConsumer(id: string): void {
    const consumer = this.consumers.get(id);
    if (!consumer) return;
    this.consumers.delete(id);
    consumer.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const consumer of this.consumers.values()) consumer.close();
    this.consumers.clear();
    // Closing a transport closes its consumers too; both are cleared anyway so a later
    // lookup cannot reach a dead object.
    for (const transport of this.transports.values()) transport.close();
    this.transports.clear();
  }
}
