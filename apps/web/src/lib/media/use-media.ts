import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocketClient } from '@/socket/client';
import { loadDevice } from './device';
import {
  afterConnect,
  beginRebuild,
  consumerClosed,
  consumerOpened,
  initialMediaState,
  isCurrent,
  type MediaState,
  needsRebuild,
  producerClosed,
  producerOpened,
  type TransportConnectionState,
  type TransportDirection,
  transportOpened,
} from './media-state';
import { signalling } from './signalling';
import { type MediaStats, type StatsSample, summarise } from './stats';
import { openTransport } from './transport';

/** Media trouble is its own state: neither the socket being down nor nobody being live. */
export type MediaHealth = 'idle' | 'connecting' | 'connected' | 'trouble';

/**
 * A reset landed while this call was in flight, so its answer is stale. An expected
 * outcome of a reconnect race, not a failure — callers swallow it and let the reset's own
 * renegotiation take over.
 */
export const SUPERSEDED = 'superseded';

export function isSuperseded(error: unknown): boolean {
  return error instanceof Error && error.message === SUPERSEDED;
}

interface Session {
  device: types.Device;
  iceServers: RTCIceServer[];
  transports: Partial<Record<TransportDirection, types.Transport>>;
  producer?: types.Producer;
  consumers: Map<string, types.Consumer>;
  /**
   * Everything below is an in-flight guard. Each of these spans a round trip, and an
   * effect can re-enter during it — so without them two callers both see "nothing yet"
   * and both allocate, and the loser is a resource nothing can name again.
   */
  pendingTransports: Partial<Record<TransportDirection, Promise<types.Transport>>>;
  pendingConsumers: Map<string, Promise<MediaStreamTrack>>;
  pendingProducer?: Promise<types.Producer>;
}

/**
 * The shell around the browser APIs. Every decision it makes comes from `media-state.ts`;
 * what lives here is the calls that need a real `RTCPeerConnection` and cannot be tested
 * without one.
 *
 * One session per socket connection. `connect` discards it wholesale rather than
 * reconciling — the server persists nothing, so a reconnection and a server restart are
 * the same event from here, and one path serves both.
 */
export function useMedia(socket: SocketClient | null) {
  const [state, setState] = useState<MediaState>(initialMediaState);
  const [health, setHealth] = useState<MediaHealth>('idle');
  const [stats, setStats] = useState<MediaStats | null>(null);
  // The counters are cumulative, so the grade is a delta against the previous sample.
  const previousSample = useRef<StatsSample | null>(null);
  const session = useRef<Session | null>(null);
  const pendingSession = useRef<Promise<Session> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const releaseSession = useCallback(() => {
    const current = session.current;
    session.current = null;
    pendingSession.current = null;
    if (!current) return;
    // One release path, as on the capture side: a partial teardown leaks a transport
    // nothing will ever name again.
    for (const consumer of current.consumers.values()) consumer.close();
    current.producer?.close();
    for (const transport of Object.values(current.transports)) transport?.close();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const reset = () => {
      releaseSession();
      setState(afterConnect);
      setHealth('connecting');
      previousSample.current = null;
    };

    socket.on('connect', reset);
    socket.on('media:reset', reset);

    return () => {
      socket.off('connect', reset);
      socket.off('media:reset', reset);
      releaseSession();
      setState(initialMediaState);
      setHealth('idle');
      setStats(null);
    };
  }, [socket, releaseSession]);

  /**
   * Polled rather than pushed: WebRTC has no event for "the line got worse", and the
   * figures are cumulative anyway, so a sample on an interval is the shape they come in.
   */
  useEffect(() => {
    const anyTransport = state.recvTransportId ?? state.sendTransportId;
    if (!anyTransport) {
      setStats(null);
      previousSample.current = null;
      return;
    }

    const sample = async () => {
      const active = session.current;
      const transport = active?.transports.recv ?? active?.transports.send;
      if (!transport || transport.closed) return;

      const report = await transport.getStats().catch(() => null);
      if (!report) return;

      for (const entry of report.values()) {
        // Inbound for a listener, remote-inbound for a speaker. They do NOT carry the same
        // fields: the remote report has no packet count and gives `fractionLost` instead.
        if (entry.type === 'inbound-rtp' || entry.type === 'remote-inbound-rtp') {
          const current = entry as StatsSample;
          const summary = summarise(current, previousSample.current ?? undefined);
          previousSample.current = current;
          if (summary) setStats(summary);
          return;
        }
      }
    };

    void sample();
    const timer = setInterval(() => void sample(), STATS_POLL_MS);
    return () => clearInterval(timer);
  }, [state.recvTransportId, state.sendTransportId]);

  const ensureSession = useCallback(async (): Promise<Session> => {
    if (session.current) return session.current;
    if (pendingSession.current) return pendingSession.current;
    if (!socket) throw new Error('No socket.');

    const loading = loadDevice(signalling(socket))
      .then(({ device, iceServers }) => {
        const created: Session = {
          device,
          iceServers,
          transports: {},
          consumers: new Map(),
          pendingTransports: {},
          pendingConsumers: new Map(),
        };
        session.current = created;
        setState((prev) => ({ ...prev, deviceLoaded: true }));
        return created;
      })
      .finally(() => {
        pendingSession.current = null;
      });

    pendingSession.current = loading;
    return loading;
  }, [socket]);

  const ensureTransport = useCallback(
    async (direction: TransportDirection, slug?: string): Promise<types.Transport> => {
      const active = await ensureSession();
      const existing = active.transports[direction];
      if (existing && !existing.closed) return existing;

      const inFlight = active.pendingTransports[direction];
      if (inFlight) return inFlight;

      if (!socket) throw new Error('No socket.');
      const generation = stateRef.current.generation;
      const opening = openTransport({
        api: signalling(socket),
        device: active.device,
        direction,
        iceServers: active.iceServers,
        slug,
      }).finally(() => {
        delete active.pendingTransports[direction];
      });
      active.pendingTransports[direction] = opening;
      const transport = await opening;

      // A connect that landed while this was in flight already voided it. Adopting the
      // answer now would hand back a transport the server no longer knows about.
      if (!isCurrent(stateRef.current, generation) || session.current !== active) {
        transport.close();
        throw new Error(SUPERSEDED);
      }

      transport.on('connectionstatechange', (next: TransportConnectionState) => {
        setHealth(
          next === 'connected' ? 'connected' : needsRebuild(next) ? 'trouble' : 'connecting',
        );
        if (!needsRebuild(next)) return;
        transport.close();
        delete active.transports[direction];
        setState((prev) => beginRebuild(prev, direction));
      });

      active.transports[direction] = transport;
      setState((prev) => transportOpened(prev, direction, transport.id));
      return transport;
    },
    [ensureSession, socket],
  );

  const startProducing = useCallback(
    async (slug: string, track: MediaStreamTrack, paused: boolean) => {
      const started = session.current?.pendingProducer;
      // Re-entering while the first produce is still in flight would close it and start
      // another, which the server broadcasts as the channel going offline and back on.
      if (started) return started;

      const produce = (async () => {
        const transport = await ensureTransport('send', slug);
        const active = session.current;
        if (!active) throw new Error(SUPERSEDED);

        active.producer?.close();
        const producer = await transport.produce({ track, ...producerOptions });
        if (paused) await producer.pause();
        active.producer = producer;
        setState((prev) => producerOpened(prev, producer.id));
        return producer;
      })();

      const active = session.current;
      if (active) {
        active.pendingProducer = produce;
        void produce
          .catch(() => {})
          .finally(() => {
            if (session.current === active) active.pendingProducer = undefined;
          });
      }
      return produce;
    },
    [ensureTransport],
  );

  const stopProducing = useCallback(async () => {
    const active = session.current;
    const producer = active?.producer;
    if (!active || !producer || !socket) return;
    active.producer = undefined;
    producer.close();
    setState(producerClosed);
    await signalling(socket).closeProducer(producer.id);
  }, [socket]);

  const setProducerPaused = useCallback(
    async (paused: boolean) => {
      const producer = session.current?.producer;
      if (!producer || !socket) return;
      const api = signalling(socket);
      if (paused) {
        producer.pause();
        await api.pauseProducer(producer.id);
      } else {
        producer.resume();
        await api.resumeProducer(producer.id);
      }
    },
    [socket],
  );

  const startConsuming = useCallback(
    async (slug: string): Promise<MediaStreamTrack> => {
      const started = session.current?.pendingConsumers.get(slug);
      // The effect that drives this depends on the consumers map, which a close mutates
      // synchronously — so it re-enters while the first consume is still awaiting.
      if (started) return started;

      const consume = (async () => {
        const transport = await ensureTransport('recv');
        const active = session.current;
        if (!socket || !active) throw new Error(SUPERSEDED);

        const api = signalling(socket);
        const params = await api.consume(slug, active.device.rtpCapabilities);
        const consumer = await transport.consume({
          id: params.consumerId,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });
        active.consumers.set(slug, consumer);
        setState((prev) => consumerOpened(prev, slug, consumer.id));

        // Resumed only once the track is in hand, per the server creating it paused: RTP
        // arriving before the decoder is ready is the usual cause of artefacts at join.
        await api.resumeConsumer(consumer.id);
        return consumer.track;
      })();

      const active = session.current;
      if (active) {
        active.pendingConsumers.set(slug, consume);
        void consume
          .catch(() => {})
          .finally(() => {
            if (session.current === active) active.pendingConsumers.delete(slug);
          });
      }
      return consume;
    },
    [ensureTransport, socket],
  );

  const stopConsuming = useCallback(
    async (slug: string) => {
      const active = session.current;
      const consumer = active?.consumers.get(slug);
      if (!active || !consumer || !socket) return;
      active.consumers.delete(slug);
      consumer.close();
      setState((prev) => consumerClosed(prev, slug));
      await signalling(socket).closeConsumer(consumer.id);
    },
    [socket],
  );

  return {
    state,
    health,
    stats,
    startProducing,
    stopProducing,
    setProducerPaused,
    startConsuming,
    stopConsuming,
    release: releaseSession,
  };
}

/** Often enough that a line going bad shows up within a sentence, cheap enough to ignore. */
const STATS_POLL_MS = 2_000;

/**
 * The browser's default 20ms packetization and default receive jitter buffer are both
 * kept. Enlarging the buffer is the only latency knob left once forwarding is fixed, and
 * spending it would trade away the thing the product exists for.
 */
const producerOptions = {
  codecOptions: { opusStereo: false, opusFec: true, opusDtx: true },
} as const;
