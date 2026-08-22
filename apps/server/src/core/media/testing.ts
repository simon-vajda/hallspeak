import { EventEmitter } from 'node:events';
import type { TurnConfig } from './config';
import { createTransport, produce, startMedia, stopMedia } from './index';
import type { WorkerFactory } from './workers';

/**
 * Stand-ins for mediasoup's own types, so a test can drive the media facade without
 * spawning a worker or binding a port. Faithful on the one behaviour that matters:
 * closing a transport closes everything produced or consumed on it, which is what makes a
 * disconnect take the producer with it.
 *
 * Imports the facade, never the singleton's startup path in `index.ts` at the app root.
 */

const seq = { producer: 0, consumer: 0, transport: 0 };

/** Failure controls make post-success notification ordering observable in facade tests. */
export const fakeMediaControls = { refuseConsume: false, failPause: false, failResume: false };

function nextId(kind: keyof typeof seq): string {
  seq[kind] += 1;
  return `${kind[0]}${seq[kind]}`;
}

class FakeProducer extends EventEmitter {
  closed = false;
  paused = false;
  readonly observer = new EventEmitter();
  constructor(
    readonly id: string,
    readonly appData: Record<string, unknown> = {},
    paused = false,
  ) {
    super();
    this.paused = paused;
  }
  close = () => {
    if (this.closed) return;
    this.closed = true;
    this.observer.emit('close');
  };
  pause = async () => {
    if (fakeMediaControls.failPause) throw new Error('pause failed');
    this.paused = true;
  };
  resume = async () => {
    if (fakeMediaControls.failResume) throw new Error('resume failed');
    this.paused = false;
  };
}

class FakeConsumer extends EventEmitter {
  closed = false;
  paused = true;
  readonly kind = 'audio';
  readonly rtpParameters = { codecs: [] };
  readonly observer = new EventEmitter();
  constructor(
    readonly id: string,
    readonly producerId: string,
    readonly appData: Record<string, unknown> = {},
  ) {
    super();
  }
  close = () => {
    if (this.closed) return;
    this.closed = true;
    // mediasoup emits this when the consumer closes for any reason, including its
    // producer going away. Peer's cleanup hangs off it, so a fake that stays silent
    // makes that cleanup untestable.
    this.observer.emit('close');
  };
  resume = async () => {
    this.paused = false;
  };
}

class FakeTransport {
  closed = false;
  readonly iceParameters = { usernameFragment: 'u' };
  readonly iceCandidates = [{ foundation: 'udp' }];
  readonly dtlsParameters = { role: 'auto' };
  private readonly children: Array<{ close: () => void }> = [];

  constructor(
    readonly id: string,
    private readonly router: FakeRouter,
  ) {}

  connect = async () => {};

  close = () => {
    this.closed = true;
    for (const child of this.children) child.close();
  };

  // mediasoup stores whatever appData it is handed on the producer, and `Room` reads the
  // slug back off it, so a fake that dropped the option would make that read untestable.
  produce = async ({
    appData,
    paused = false,
  }: {
    appData?: Record<string, unknown>;
    paused?: boolean;
  } = {}) => {
    const producer = new FakeProducer(nextId('producer'), appData ?? {}, paused);
    this.children.push(producer);
    this.router.registerProducer(producer);
    return producer;
  };

  consume = async ({
    producerId,
    appData,
  }: {
    producerId: string;
    appData?: Record<string, unknown>;
  }) => {
    const consumer = new FakeConsumer(nextId('consumer'), producerId, appData ?? {});
    this.children.push(consumer);
    this.router.registerConsumer(consumer);
    return consumer;
  };
}

class FakeRouter {
  closed = false;
  readonly rtpCapabilities = { codecs: [{ mimeType: 'audio/opus' }] };
  readonly observer = new EventEmitter();
  private readonly consumersByProducer = new Map<string, FakeConsumer[]>();

  canConsume = () => !fakeMediaControls.refuseConsume;

  close = () => {
    this.closed = true;
    this.observer.emit('close');
  };

  async createWebRtcTransport() {
    return new FakeTransport(nextId('transport'), this);
  }

  /**
   * mediasoup closes every consumer of a producer when that producer closes, wherever
   * those consumers live. It is the cascade that stops a listener's audio the instant a
   * speaker does, so a fake that omits it makes the whole path untestable — and the two
   * sides sit on different transports, so the link belongs here, on the shared router.
   */
  registerProducer(producer: FakeProducer): void {
    producer.observer.once('close', () => {
      for (const consumer of this.consumersByProducer.get(producer.id) ?? []) consumer.close();
      this.consumersByProducer.delete(producer.id);
    });
  }

  registerConsumer(consumer: FakeConsumer): void {
    const existing = this.consumersByProducer.get(consumer.producerId) ?? [];
    existing.push(consumer);
    this.consumersByProducer.set(consumer.producerId, existing);
  }
}

class FakeWorker extends EventEmitter {
  closed = false;
  async createWebRtcServer() {
    return { close: () => {} };
  }
  async createRouter() {
    return new FakeRouter();
  }
  close() {
    this.closed = true;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
export const fakeWorkerFactory = (async () => new FakeWorker() as any) as WorkerFactory;

export interface FakeMediaOptions {
  graceMs?: number;
  turn?: TurnConfig;
}

/** Starts the media singleton on fake workers; the returned function stops it again. */
export async function startFakeMedia(options: FakeMediaOptions = {}): Promise<() => Promise<void>> {
  seq.producer = 0;
  seq.consumer = 0;
  seq.transport = 0;
  fakeMediaControls.refuseConsume = false;
  fakeMediaControls.failPause = false;
  fakeMediaControls.failResume = false;
  await startMedia({
    net: { listenIp: '0.0.0.0', announcedIp: '203.0.113.1', rtcPortBase: 44400, maxWorkers: 1 },
    turn: options.turn ?? {},
    hostCpuCount: 1,
    graceMs: options.graceMs,
    createWorker: fakeWorkerFactory,
  });
  return stopMedia;
}

/** The two calls a speaker makes to go live, so a test can say what it means. */
export async function goLive(input: {
  eventId: number;
  socketId: string;
  channelId: number;
  slug: string;
}): Promise<{ producerId: string }> {
  const ctx = { eventId: input.eventId, socketId: input.socketId };
  await createTransport(ctx, 'send', { create: true });
  return produce(ctx, {
    channelId: input.channelId,
    slug: input.slug,
    rtpParameters: { codecs: [] },
    paused: false,
  });
}
