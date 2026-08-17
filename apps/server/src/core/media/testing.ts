import { EventEmitter } from 'node:events';
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

function nextId(kind: keyof typeof seq): string {
  seq[kind] += 1;
  return `${kind[0]}${seq[kind]}`;
}

class FakeProducer extends EventEmitter {
  closed = false;
  paused = false;
  readonly observer = new EventEmitter();
  constructor(readonly id: string) {
    super();
  }
  close = () => {
    if (this.closed) return;
    this.closed = true;
    this.observer.emit('close');
  };
  pause = async () => {
    this.paused = true;
  };
  resume = async () => {
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
  ) {
    super();
  }
  close = () => {
    this.closed = true;
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

  constructor(readonly id: string) {}

  connect = async () => {};

  close = () => {
    this.closed = true;
    for (const child of this.children) child.close();
  };

  produce = async () => {
    const producer = new FakeProducer(nextId('producer'));
    this.children.push(producer);
    return producer;
  };

  consume = async ({ producerId }: { producerId: string }) => {
    const consumer = new FakeConsumer(nextId('consumer'), producerId);
    this.children.push(consumer);
    return consumer;
  };
}

class FakeRouter {
  closed = false;
  readonly rtpCapabilities = { codecs: [{ mimeType: 'audio/opus' }] };
  readonly observer = new EventEmitter();
  canConsume = () => true;
  close = () => {
    this.closed = true;
    this.observer.emit('close');
  };
  async createWebRtcTransport() {
    return new FakeTransport(nextId('transport'));
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
}

/** Starts the media singleton on fake workers; the returned function stops it again. */
export async function startFakeMedia(options: FakeMediaOptions = {}): Promise<() => Promise<void>> {
  seq.producer = 0;
  seq.consumer = 0;
  seq.transport = 0;
  await startMedia({
    net: { listenIp: '0.0.0.0', announcedIp: '203.0.113.1', rtcPortBase: 44400, maxWorkers: 1 },
    turn: {},
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
  });
}
