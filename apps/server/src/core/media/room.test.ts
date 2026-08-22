import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Room } from './room';

class FakeProducer extends EventEmitter {
  closed = false;
  paused = false;
  constructor(
    readonly id: string,
    readonly appData: Record<string, unknown> = {},
  ) {
    super();
  }
  close = vi.fn(() => {
    this.closed = true;
    this.observer.emit('close');
  });
  pause = vi.fn(async () => {
    this.paused = true;
  });
  resume = vi.fn(async () => {
    this.paused = false;
  });
  readonly observer = new EventEmitter();
}

class FakeConsumer extends EventEmitter {
  closed = false;
  /** Consumers are created paused, per the join-artefact discipline in the facade. */
  paused = true;
  readonly observer = new EventEmitter();
  constructor(
    readonly id: string,
    readonly producerId: string,
  ) {
    super();
  }
  close = vi.fn(() => {
    this.closed = true;
    this.observer.emit('close');
  });
  resume = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(async () => {
    this.paused = true;
  });
}

class FakeRouter {
  closed = false;
  readonly created: unknown[] = [];
  readonly rtpCapabilities = { codecs: [{ mimeType: 'audio/opus' }] };
  failNextTransport = false;

  // biome-ignore lint/suspicious/noExplicitAny: a stand-in for mediasoup's Router.
  async createWebRtcTransport(_options: any): Promise<any> {
    if (this.failNextTransport) throw new Error('port allocation failed');
    const transport = {
      id: `t${this.created.length}`,
      closed: false,
      close: vi.fn(),
      appData: {},
    };
    this.created.push(transport);
    return transport;
  }

  close = vi.fn(() => {
    this.closed = true;
  });
}

// biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
const as = (value: unknown) => value as any;

function room(router = new FakeRouter()) {
  return {
    router,
    room: new Room({
      eventId: 7,
      router: as(router),
      webRtcServer: as({ id: 'wrs' }),
      workerIndex: 0,
    }),
  };
}

describe('Room producers', () => {
  it('holds producers for two channels on the one router', () => {
    const { room: r, router } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    r.setProducer(2, as(new FakeProducer('p2')));

    expect(r.producer(1)?.id).toBe('p1');
    expect(r.producer(2)?.id).toBe('p2');
    expect(router.closed).toBe(false);
  });

  it('is online for a channel only while an unclosed producer exists', () => {
    const { room: r } = room();
    expect(r.isOnline(1)).toBe(false);

    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));
    expect(r.isOnline(1)).toBe(true);

    r.closeProducer(1);
    expect(r.isOnline(1)).toBe(false);
  });

  it('stays online across a pause, because mute is not the end of a broadcast', async () => {
    const { room: r } = room();
    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));

    await producer.pause();

    expect(r.isOnline(1)).toBe(true);
  });

  it('reports one authoritative online and muted snapshot', async () => {
    const { room: r } = room();
    expect(r.channelStatus(1)).toEqual({ online: false, muted: false });

    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));
    expect(r.channelStatus(1)).toEqual({ online: true, muted: false });

    await producer.pause();
    expect(r.channelStatus(1)).toEqual({ online: true, muted: true });

    await producer.resume();
    expect(r.channelStatus(1)).toEqual({ online: true, muted: false });

    producer.close();
    expect(r.channelStatus(1)).toEqual({ online: false, muted: false });
  });

  it('replaces rather than duplicates when one channel produces twice', () => {
    const { room: r } = room();
    const first = new FakeProducer('p1');
    r.setProducer(1, as(first));
    r.setProducer(1, as(new FakeProducer('p2')));

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(r.producer(1)?.id).toBe('p2');
    expect(r.producerCount).toBe(1);
  });

  it('forgets a producer that closes on its own', () => {
    const { room: r } = room();
    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));

    producer.close();

    expect(r.producer(1)).toBeUndefined();
    expect(r.isOnline(1)).toBe(false);
  });

  it('closing an absent producer is a no-op', () => {
    const { room: r } = room();
    expect(() => r.closeProducer(99)).not.toThrow();
    expect(r.producerCount).toBe(0);
  });
});

describe('Room.listenerCount', () => {
  /**
   * A listener is a guest holding an open, locally unpaused consumer — somebody actually
   * receiving audio, not somebody with a page open. It is structurally zero until the
   * interpreter goes live, and that is the intended reading.
   */
  const listen = async (r: Room, socketId: string, producerId: string, id: string) => {
    const consumer = new FakeConsumer(id, producerId);
    r.peerFor(socketId).addConsumer(as(consumer));
    await consumer.resume();
    return consumer;
  };

  it('is zero when no producer exists on the channel', () => {
    const { room: r } = room();
    expect(r.listenerCount(1)).toBe(0);
  });

  it('is zero for a producer nobody consumes', () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    expect(r.listenerCount(1)).toBe(0);
  });

  it('excludes a consumer that has never been resumed', () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    r.peerFor('socket-1').addConsumer(as(new FakeConsumer('c1', 'p1')));

    expect(r.listenerCount(1)).toBe(0);
  });

  it('counts one peer per resumed consumer', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));

    await listen(r, 'socket-1', 'p1', 'c1');
    expect(r.listenerCount(1)).toBe(1);

    await listen(r, 'socket-2', 'p1', 'c2');
    expect(r.listenerCount(1)).toBe(2);
  });

  /**
   * No client can reach this state today — the contract carries no pause-consumer event
   * and the guest closes instead. The case pins the definition against one arriving.
   */
  it('excludes a resumed consumer that was locally paused again', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    const consumer = await listen(r, 'socket-1', 'p1', 'c1');

    await consumer.pause();

    expect(r.listenerCount(1)).toBe(0);
  });

  it('is unchanged while the producer is paused, because a muted speaker still has listeners', async () => {
    const { room: r } = room();
    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));
    await listen(r, 'socket-1', 'p1', 'c1');

    await producer.pause();

    expect(r.listenerCount(1)).toBe(1);
  });

  it('counts each channel separately', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    r.setProducer(2, as(new FakeProducer('p2')));
    await listen(r, 'socket-1', 'p1', 'c1');
    await listen(r, 'socket-2', 'p2', 'c2');
    await listen(r, 'socket-3', 'p2', 'c3');

    expect(r.listenerCount(1)).toBe(1);
    expect(r.listenerCount(2)).toBe(2);
  });

  it('drops a consumer that closes', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    const consumer = await listen(r, 'socket-1', 'p1', 'c1');

    consumer.close();

    expect(r.listenerCount(1)).toBe(0);
  });

  it('drops a peer that closes', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    await listen(r, 'socket-1', 'p1', 'c1');
    await listen(r, 'socket-2', 'p1', 'c2');

    r.closePeer('socket-1');

    expect(r.listenerCount(1)).toBe(1);
  });

  it('is zero once the producer closes', async () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    await listen(r, 'socket-1', 'p1', 'c1');

    r.closeProducer(1);

    expect(r.listenerCount(1)).toBe(0);
  });
});

describe('Room.liveChannels', () => {
  it('names each live channel and the slug its producer carries', () => {
    const { room: r } = room();
    r.setProducer(10, as(new FakeProducer('p1', { channelId: 10, slug: 'english' })));
    r.setProducer(11, as(new FakeProducer('p2', { channelId: 11, slug: 'spanish' })));

    expect(r.liveChannels()).toEqual([
      { channelId: 10, slug: 'english' },
      { channelId: 11, slug: 'spanish' },
    ]);
  });

  it('is empty once every producer has gone', () => {
    const { room: r } = room();
    const producer = new FakeProducer('p1', { channelId: 10, slug: 'english' });
    r.setProducer(10, as(producer));
    producer.close();

    expect(r.liveChannels()).toEqual([]);
  });
});

describe('Room peers', () => {
  it('returns nothing for an unknown socket id rather than throwing', () => {
    const { room: r } = room();
    expect(r.peer('nobody')).toBeUndefined();
  });

  it('creates a peer on demand and returns the same one afterwards', () => {
    const { room: r } = room();
    const peer = r.peerFor('socket-1');
    expect(r.peerFor('socket-1')).toBe(peer);
    expect(r.peer('socket-1')).toBe(peer);
  });

  it('closing one peer leaves the others untouched', async () => {
    const { room: r, router } = room();
    const first = r.peerFor('socket-1');
    const second = r.peerFor('socket-2');
    first.addTransport('recv', as(await router.createWebRtcTransport({})));
    second.addTransport('recv', as(await router.createWebRtcTransport({})));

    r.closePeer('socket-1');

    expect(r.peer('socket-1')).toBeUndefined();
    expect(r.peer('socket-2')).toBe(second);
    expect(second.isEmpty).toBe(false);
  });

  it('closing a peer twice is a no-op the second time', () => {
    const { room: r } = room();
    r.peerFor('socket-1');
    r.closePeer('socket-1');
    expect(() => r.closePeer('socket-1')).not.toThrow();
  });
});

describe('Room.createTransport', () => {
  it('raises an AppError with a distinct code when allocation fails', async () => {
    const { room: r, router } = room();
    router.failNextTransport = true;

    await expect(r.createTransport('socket-1', 'recv')).rejects.toMatchObject({
      code: 'media_unavailable',
      name: 'AppError',
    });
  });

  it('leaves no half-registered transport behind after a failure', async () => {
    const { room: r, router } = room();
    router.failNextTransport = true;
    await expect(r.createTransport('socket-1', 'send')).rejects.toThrow();

    router.failNextTransport = false;
    await expect(r.createTransport('socket-1', 'send')).resolves.toBeDefined();
  });

  it('refuses a second transport in the same direction', async () => {
    const { room: r } = room();
    await r.createTransport('socket-1', 'send');

    await expect(r.createTransport('socket-1', 'send')).rejects.toMatchObject({
      code: 'transport_exists',
    });
  });

  /**
   * The pre-check catches a sequential second call, but two that interleave across the
   * allocation await both pass it. The loser is then a transport nothing will ever name
   * again, so it has to be closed rather than left to the garbage collector.
   */
  it('closes the transport the peer refuses when two creates race', async () => {
    const { room: r, router } = room();

    const results = await Promise.allSettled([
      r.createTransport('socket-1', 'send'),
      r.createTransport('socket-1', 'send'),
    ]);

    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect(router.created).toHaveLength(2);

    const closed = (router.created as Array<{ close: ReturnType<typeof vi.fn> }>).filter(
      (t) => t.close.mock.calls.length > 0,
    );
    expect(closed).toHaveLength(1);
  });
});

describe('Room.close', () => {
  it('closes every producer, every peer and the router itself', () => {
    const { room: r, router } = room();
    const producer = new FakeProducer('p1');
    r.setProducer(1, as(producer));
    r.peerFor('socket-1');

    r.close();

    expect(producer.close).toHaveBeenCalled();
    expect(router.close).toHaveBeenCalledTimes(1);
    expect(r.peer('socket-1')).toBeUndefined();
    expect(r.isIdle).toBe(true);
  });

  it('is a no-op the second time', () => {
    const { room: r, router } = room();
    r.close();
    r.close();
    expect(router.close).toHaveBeenCalledTimes(1);
  });
});

describe('Room.isIdle', () => {
  it('is idle with no producers and no transports', () => {
    const { room: r } = room();
    expect(r.isIdle).toBe(true);
  });

  it('is not idle while a producer exists', () => {
    const { room: r } = room();
    r.setProducer(1, as(new FakeProducer('p1')));
    expect(r.isIdle).toBe(false);
  });

  it('is not idle while a peer still holds a transport, even with no producer', async () => {
    const { room: r } = room();
    await r.createTransport('socket-1', 'recv');
    expect(r.isIdle).toBe(false);
  });

  it('an empty peer with no transport does not keep it busy', () => {
    const { room: r } = room();
    r.peerFor('socket-1');
    expect(r.isIdle).toBe(true);
  });
});
