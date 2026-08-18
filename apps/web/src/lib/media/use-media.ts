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
import { type MediaStats, summarise } from './stats';
import { openTransport } from './transport';

/** Media trouble is its own state: neither the socket being down nor nobody being live. */
export type MediaHealth = 'idle' | 'connecting' | 'connected' | 'trouble';

interface Session {
  device: types.Device;
  iceServers: RTCIceServer[];
  transports: Partial<Record<TransportDirection, types.Transport>>;
  producer?: types.Producer;
  consumers: Map<string, types.Consumer>;
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
  const session = useRef<Session | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const releaseSession = useCallback(() => {
    const current = session.current;
    session.current = null;
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
      return;
    }

    const sample = async () => {
      const active = session.current;
      const transport = active?.transports.recv ?? active?.transports.send;
      if (!transport || transport.closed) return;

      const report = await transport.getStats().catch(() => null);
      if (!report) return;

      for (const entry of report.values()) {
        // Inbound for a listener, remote-inbound for a speaker: only one exists per peer,
        // and both carry the two figures the grade is made of.
        if (entry.type === 'inbound-rtp' || entry.type === 'remote-inbound-rtp') {
          const summary = summarise(entry as Record<string, number>);
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
    if (!socket) throw new Error('No socket.');
    const { device, iceServers } = await loadDevice(signalling(socket));
    const created: Session = { device, iceServers, transports: {}, consumers: new Map() };
    session.current = created;
    setState((prev) => ({ ...prev, deviceLoaded: true }));
    return created;
  }, [socket]);

  const ensureTransport = useCallback(
    async (direction: TransportDirection, slug?: string): Promise<types.Transport> => {
      const active = await ensureSession();
      const existing = active.transports[direction];
      if (existing && !existing.closed) return existing;

      if (!socket) throw new Error('No socket.');
      const generation = stateRef.current.generation;
      const transport = await openTransport({
        api: signalling(socket),
        device: active.device,
        direction,
        iceServers: active.iceServers,
        slug,
      });

      // A connect that landed while this was in flight already voided it. Adopting the
      // answer now would hand back a transport the server no longer knows about.
      if (!isCurrent(stateRef.current, generation) || session.current !== active) {
        transport.close();
        throw new Error('superseded');
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
      const transport = await ensureTransport('send', slug);
      const active = session.current;
      if (!active) throw new Error('superseded');

      active.producer?.close();
      const producer = await transport.produce({ track, ...producerOptions });
      if (paused) await producer.pause();
      active.producer = producer;
      setState((prev) => producerOpened(prev, producer.id));
      return producer;
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
      const transport = await ensureTransport('recv');
      const active = session.current;
      if (!socket || !active) throw new Error('superseded');

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
