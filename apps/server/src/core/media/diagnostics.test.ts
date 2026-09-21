import { EventEmitter } from 'node:events';
import type { types } from 'mediasoup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogDestination } from '../../lib/log';
import { watchConsumer, watchProducer, watchTransport } from './diagnostics';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'trace', LOG_DIR: '' },
}));
vi.mock('../../env', () => ({ env: envMock }));

const SILENCE_CHECK_MS = 5_000;
const REMOTE_ADDRESS = '198.51.100.77';
const CANDIDATE_ADDRESS = '203.0.113.10';
const TRANSPORT_ID = 'abcdef0123456789';

const WARN = 40;
const DEBUG = 20;
const TRACE = 10;

class FakeTransport extends EventEmitter {
  readonly id = TRANSPORT_ID;
  readonly observer = new EventEmitter();
  closed = false;
  iceState = 'new';
  dtlsState = 'new';
  readonly iceCandidates = [{ protocol: 'udp', address: CANDIDATE_ADDRESS, port: 44400 }];
}

class FakeProducer {
  readonly id = TRANSPORT_ID;
  readonly observer = new EventEmitter();
  closed = false;
  paused = false;
  constructor(private readonly bytes: number) {}
  async getStats() {
    return [{ type: 'inbound-rtp', byteCount: this.bytes }];
  }
}

class FakeConsumer {
  readonly id = TRANSPORT_ID;
  readonly observer = new EventEmitter();
  closed = false;
  paused = false;
  constructor(private readonly bytes: number) {}
  async getStats() {
    return [{ type: 'outbound-rtp', byteCount: this.bytes }];
  }
}

const asTransport = (t: FakeTransport) => t as unknown as types.WebRtcTransport;
const asProducer = (p: FakeProducer) => p as unknown as types.Producer;
const asConsumer = (c: FakeConsumer) => c as unknown as types.Consumer;

let records: Record<string, unknown>[];

/** Lets the getStats promise settle after the timer that started it has fired. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SILENCE_CHECK_MS);
  await vi.waitFor(() => {});
}

const at = (level: number) => records.filter((record) => record.level === level);
const serialized = () => records.map((record) => JSON.stringify(record));

beforeEach(() => {
  vi.useFakeTimers();
  records = [];
  useLogDestination({
    write(chunk: string) {
      records.push(JSON.parse(chunk));
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the silent-failure warnings', () => {
  it('warns about a transport that never connected, carrying both states as fields', async () => {
    watchTransport(asTransport(new FakeTransport()), 3, 'recv');

    await settle();

    const warnings = at(WARN);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      msg: expect.stringContaining('no ICE connectivity'),
      eventId: 3,
      direction: 'recv',
      iceState: 'new',
      dtlsState: 'new',
      afterMs: SILENCE_CHECK_MS,
      subsystem: 'media',
    });
  });

  it('stays silent about a transport that did connect', async () => {
    const transport = new FakeTransport();
    transport.iceState = 'connected';
    watchTransport(asTransport(transport), 3, 'recv');

    await settle();

    expect(at(WARN)).toEqual([]);
  });

  it('warns about a producer that received no RTP, with the channel as a field', async () => {
    watchProducer(asProducer(new FakeProducer(0)), 3, 'de');

    await settle();

    const warnings = at(WARN);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      msg: expect.stringContaining('no RTP received'),
      eventId: 3,
      slug: 'de',
    });
  });

  it('warns about a consumer that sent no RTP, with the channel as a field', async () => {
    watchConsumer(asConsumer(new FakeConsumer(0)), 3, 'de');

    await settle();

    const warnings = at(WARN);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ msg: 'no RTP sent', eventId: 3, slug: 'de' });
  });

  it('names no transport or producer identifier on a warning', async () => {
    const transport = new FakeTransport();
    watchTransport(asTransport(transport), 3, 'recv');
    watchProducer(asProducer(new FakeProducer(0)), 3, 'de');
    watchConsumer(asConsumer(new FakeConsumer(0)), 3, 'de');

    await settle();

    expect(at(WARN)).toHaveLength(3);
    for (const warning of at(WARN)) {
      expect(JSON.stringify(warning)).not.toContain(TRANSPORT_ID.slice(0, 8));
    }
  });

  it('carries no address on any record above trace', async () => {
    const transport = new FakeTransport();
    watchTransport(asTransport(transport), 3, 'recv');
    transport.emit('iceselectedtuplechange', {
      protocol: 'udp',
      localAddress: '0.0.0.0',
      localPort: 44400,
      remoteIp: REMOTE_ADDRESS,
      remotePort: 50000,
    });

    await settle();

    for (const record of records.filter((entry) => Number(entry.level) > TRACE)) {
      const line = JSON.stringify(record);
      expect(line).not.toContain(REMOTE_ADDRESS);
      expect(line).not.toContain(CANDIDATE_ADDRESS);
    }
  });
});

describe('the connection narration', () => {
  function narrate(transport: FakeTransport): void {
    watchTransport(asTransport(transport), 3, 'recv');
    transport.emit('icestatechange', 'connected');
    transport.emit('icestatechange', 'disconnected');
    transport.emit('dtlsstatechange', 'connected');
    transport.emit('dtlsstatechange', 'failed');
    transport.emit('iceselectedtuplechange', {
      protocol: 'udp',
      localAddress: '0.0.0.0',
      localPort: 44400,
      remoteIp: REMOTE_ADDRESS,
      remotePort: 50000,
    });
    transport.observer.emit('close');
  }

  it('writes creation, ICE, DTLS and close at debug, each state as a field', () => {
    narrate(new FakeTransport());

    const debug = at(DEBUG);
    expect(debug.map((record) => record.msg)).toEqual([
      'transport created',
      'ice state changed',
      'ice state changed',
      'dtls state changed',
      'dtls state changed',
      'transport closed',
    ]);
    expect(debug[0]).toMatchObject({ transportId: TRANSPORT_ID.slice(0, 8), candidateCount: 1 });
    expect(debug.map((record) => record.iceState)).toContain('disconnected');
    expect(debug.map((record) => record.dtlsState)).toContain('failed');
  });

  it('keeps the offered candidate and the selected pair at trace', () => {
    narrate(new FakeTransport());

    const trace = at(TRACE);
    expect(trace).toHaveLength(2);
    expect(trace[0]).toMatchObject({
      msg: 'candidate offered',
      address: CANDIDATE_ADDRESS,
      port: 44400,
      protocol: 'udp',
    });
    expect(trace[1]).toMatchObject({
      msg: 'ice pair selected',
      localAddress: '0.0.0.0',
      remoteAddress: REMOTE_ADDRESS,
      remotePort: 50000,
    });
  });

  it('reports a healthy byte count at debug and warns about nothing', async () => {
    watchProducer(asProducer(new FakeProducer(4_096)), 3, 'de');
    watchConsumer(asConsumer(new FakeConsumer(2_048)), 3, 'de');

    await settle();

    expect(at(DEBUG)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'producer receiving RTP', bytes: 4_096 }),
        expect.objectContaining({ msg: 'consumer sending RTP', bytes: 2_048 }),
      ]),
    );
    expect(at(WARN)).toEqual([]);
  });

  it('carries the paused state of a producer as a field', () => {
    const producer = new FakeProducer(0);
    producer.paused = true;
    watchProducer(asProducer(producer), 3, 'de');

    expect(at(DEBUG)[0]).toMatchObject({ msg: 'producer opened', paused: true, slug: 'de' });
  });

  it('stays out of the way of a closed producer, writing only its close', async () => {
    const producer = new FakeProducer(0);
    watchProducer(asProducer(producer), 3, 'de');
    producer.closed = true;
    producer.observer.emit('close');

    await settle();

    expect(at(WARN)).toEqual([]);
    expect(serialized().filter((line) => line.includes('producer closed'))).toHaveLength(1);
  });

  it('stays silent about a consumer that is merely paused', async () => {
    const consumer = new FakeConsumer(0);
    consumer.paused = true;
    watchConsumer(asConsumer(consumer), 3, 'de');

    await settle();

    expect(records).toEqual([]);
  });
});
