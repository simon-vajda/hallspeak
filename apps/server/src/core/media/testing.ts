import { EventEmitter } from 'node:events';
import type { types } from 'mediasoup';
import type { AddressResolver } from './announced-address';
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

const seq = { producer: 0, consumer: 0, transport: 0, iceRestart: 0 };

/** Failure controls make post-success notification ordering observable in facade tests. */
export const fakeMediaControls = { refuseConsume: false, failPause: false, failResume: false };

let currentWorker: FakeWorker | undefined;
let announcedListenInfos: types.TransportListenInfo[] = [];
/** What the pool told the worker to announce; every fake candidate carries it. */
let announcedByPool = '';

/** The listen infos the pool handed the worker, so a test can read what is announced. */
export function fakeListenInfos(): types.TransportListenInfo[] {
  return announcedListenInfos;
}

/** Simulates mediasoup losing its worker after startup. */
export function failWorker(): void {
  currentWorker?.die();
}

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
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.observer.emit('close');
  };
  getStats = async () => [];
  pause = async () => {
    if (fakeMediaControls.failPause) {
      throw new Error('pause failed');
    }
    this.paused = true;
  };
  resume = async () => {
    if (fakeMediaControls.failResume) {
      throw new Error('resume failed');
    }
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
    if (this.closed) {
      return;
    }
    this.closed = true;
    // mediasoup emits this when the consumer closes for any reason, including its
    // producer going away. Peer's cleanup hangs off it, so a fake that stays silent
    // makes that cleanup untestable.
    this.observer.emit('close');
  };
  getStats = async () => [];
  resume = async () => {
    this.paused = false;
  };
}

class FakeTransport extends EventEmitter {
  closed = false;
  readonly iceParameters = { usernameFragment: 'u' };
  // Shaped like mediasoup's own, because `createTransport` derives a literal-addressed
  // twin from every field here and a stub would make that derivation untestable. The
  // announced address is the one the pool was built with.
  readonly iceCandidates: types.IceCandidate[] = [
    {
      foundation: 'udpcandidate',
      priority: 1076302079,
      ip: announcedByPool,
      address: announcedByPool,
      protocol: 'udp',
      port: 44400,
      type: 'host',
    },
    {
      foundation: 'tcpcandidate',
      priority: 1076302078,
      ip: announcedByPool,
      address: announcedByPool,
      protocol: 'tcp',
      port: 44400,
      type: 'host',
      tcpType: 'passive',
    },
  ];
  readonly dtlsParameters = { role: 'auto' };
  readonly iceState = 'connected';
  readonly dtlsState = 'connected';
  readonly observer = new EventEmitter();
  private readonly children: Array<{ close: () => void }> = [];

  constructor(
    readonly id: string,
    private readonly router: FakeRouter,
  ) {
    super();
  }

  connect = async () => {};

  restartIce = async () => ({ usernameFragment: `restart-${++seq.iceRestart}` });

  close = () => {
    this.closed = true;
    for (const child of this.children) {
      child.close();
    }
    this.observer.emit('close');
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
      for (const consumer of this.consumersByProducer.get(producer.id) ?? []) {
        consumer.close();
      }
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
  async createWebRtcServer({ listenInfos }: { listenInfos: types.TransportListenInfo[] }) {
    announcedListenInfos = listenInfos;
    announcedByPool = listenInfos[0]?.announcedAddress ?? announcedByPool;
    return { close: () => {} };
  }
  async createRouter() {
    return new FakeRouter();
  }
  close() {
    this.closed = true;
  }
  die() {
    this.emit('died', new Error('worker died'));
  }
}

export const fakeWorkerFactory = (async () => {
  currentWorker = new FakeWorker();
  // biome-ignore lint/suspicious/noExplicitAny: the fake stands in for mediasoup's type.
  return currentWorker as any;
}) as WorkerFactory;

export interface FakeMediaOptions {
  graceMs?: number;
  swapDeadlineMs?: number;
  stunUrl?: string;
  announcedIp?: string;
  resolveAddress?: AddressResolver;
  addressPollMs?: number;
}

/** Starts the media singleton on fake workers; the returned function stops it again. */
export async function startFakeMedia(options: FakeMediaOptions = {}): Promise<() => Promise<void>> {
  seq.producer = 0;
  seq.consumer = 0;
  seq.transport = 0;
  seq.iceRestart = 0;
  fakeMediaControls.refuseConsume = false;
  fakeMediaControls.failPause = false;
  fakeMediaControls.failResume = false;
  currentWorker = undefined;
  announcedListenInfos = [];
  announcedByPool = options.announcedIp ?? '203.0.113.1';
  await startMedia({
    net: {
      listenIp: '0.0.0.0',
      announcedIp: options.announcedIp ?? '203.0.113.1',
      rtcPortBase: 44400,
      maxWorkers: 1,
    },
    stunUrl: options.stunUrl,
    hostCpuCount: 1,
    graceMs: options.graceMs,
    swapDeadlineMs: options.swapDeadlineMs,
    createWorker: fakeWorkerFactory,
    resolveAddress: options.resolveAddress,
    addressPollMs: options.addressPollMs,
  });
  return stopMedia;
}

/** The two calls a speaker makes to go live, so a test can say what it means. */
export async function goLive(input: {
  eventId: number;
  socketId: string;
  channelId: number;
  slug: string;
  /** Defaults to one session per socket, which is what a studio page is. */
  sessionId?: string;
}): Promise<{ producerId: string }> {
  const ctx = {
    eventId: input.eventId,
    socketId: input.socketId,
    sessionId: input.sessionId ?? `${input.socketId}-studio`,
  };
  await createTransport(ctx, 'send', { create: true });
  return produce(ctx, {
    channelId: input.channelId,
    slug: input.slug,
    rtpParameters: { codecs: [] },
    paused: false,
  });
}
