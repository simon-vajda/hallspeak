import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocketClient } from '@/socket/client';
import { loadDevice } from './device';
import { logIceRecovery, reportTransportPath, watchConsumerTrack } from './diagnostics';
import type { MediaHealth } from './link-state';
import {
  afterConnect,
  beginRebuild,
  canRollbackProducerControl,
  consumerClosed,
  consumerOpened,
  iceRecoveryDelay,
  iceRecoveryStep,
  initialMediaState,
  isCurrent,
  type MediaState,
  type ProducerControlIdentity,
  producerClosed,
  producerOpened,
  type TransportConnectionState,
  type TransportDirection,
  transportOpened,
} from './media-state';
import { signalling } from './signalling';
import { type MediaStats, type StatsSample, summarise } from './stats';
import { openTransport } from './transport';

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
  pendingIceRestarts: Partial<Record<TransportDirection, Promise<void>>>;
  /**
   * Per direction rather than per transport, and cleared only by a transport reaching
   * connected: a rebuild hands the direction a brand new transport, so a per-transport
   * count would restart the ladder every time and rebuild forever.
   */
  iceRecoveryAttempts: Partial<Record<TransportDirection, number>>;
  iceRecoveryTimers: Partial<Record<TransportDirection, ReturnType<typeof setTimeout>>>;
  /**
   * Whether this direction has ever reached connected, for the same reason the attempt
   * count lives here: a rebuilt transport has no first gather to protect, and reading the
   * fact off the transport would hand every rebuild the long first-gather deadline.
   */
  iceConnectedOnce: Partial<Record<TransportDirection, boolean>>;
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
  const [reconnectRecommended, setReconnectRecommended] = useState(false);
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
    if (!current) {
      return;
    }
    // One release path, as on the capture side: a partial teardown leaks a transport
    // nothing will ever name again.
    for (const consumer of current.consumers.values()) {
      consumer.close();
    }
    for (const timer of Object.values(current.iceRecoveryTimers)) {
      clearTimeout(timer);
    }
    current.producer?.close();
    for (const transport of Object.values(current.transports)) {
      transport?.close();
    }
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const reset = () => {
      releaseSession();
      setState(afterConnect);
      setHealth('connecting');
      setReconnectRecommended(false);
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
      setReconnectRecommended(false);
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
      if (!transport || transport.closed) {
        return;
      }
      // A paused producer sends nothing, so the remote report's loss fraction describes the
      // mute rather than the line — and that report is used directly, not differenced, so
      // clearing the sample history cannot undo it. Hold the last grade instead of grading
      // the interpreter's own silence as a degraded connection.
      if (active?.producer?.paused) {
        return;
      }

      const report = await transport.getStats().catch(() => null);
      if (!report) {
        return;
      }

      for (const entry of report.values()) {
        // Inbound for a listener, remote-inbound for a speaker. They do NOT carry the same
        // fields: the remote report has no packet count and gives `fractionLost` instead.
        if (entry.type === 'inbound-rtp' || entry.type === 'remote-inbound-rtp') {
          const current = entry as StatsSample;
          const summary = summarise(current, previousSample.current ?? undefined);
          previousSample.current = current;
          if (summary) {
            setStats(summary);
          }
          return;
        }
      }
    };

    void sample();
    const timer = setInterval(() => void sample(), STATS_POLL_MS);
    return () => clearInterval(timer);
  }, [state.recvTransportId, state.sendTransportId]);

  const ensureSession = useCallback(async (): Promise<Session> => {
    if (session.current) {
      return session.current;
    }
    if (pendingSession.current) {
      return pendingSession.current;
    }
    if (!socket) {
      throw new Error('No socket.');
    }

    const loading = loadDevice(signalling(socket))
      .then(({ device, iceServers }) => {
        const created: Session = {
          device,
          iceServers,
          transports: {},
          consumers: new Map(),
          pendingTransports: {},
          pendingIceRestarts: {},
          iceRecoveryAttempts: {},
          iceRecoveryTimers: {},
          iceConnectedOnce: {},
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
      if (existing && !existing.closed) {
        return existing;
      }

      const inFlight = active.pendingTransports[direction];
      if (inFlight) {
        return inFlight;
      }

      if (!socket) {
        throw new Error('No socket.');
      }
      const generation = stateRef.current.generation;
      const opening = openTransport({
        api: signalling(socket),
        device: active.device,
        direction,
        iceServers: active.iceServers,
        slug,
        onCandidateAddressFamilyMismatch:
          direction === 'recv'
            ? () => {
                if (session.current === active) {
                  setReconnectRecommended(true);
                }
              }
            : undefined,
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

      let gaveUp = false;

      /**
       * A restart re-gathers on the peer connection this transport already owns. When that
       * connection is the problem, only replacing it helps — so the transport is dropped
       * on both sides and the effects that wanted media open a fresh one.
       */
      const rebuild = async (): Promise<void> => {
        logIceRecovery(direction, `still ${transport.connectionState} — rebuilding the transport`);
        transport.close();
        if (active.transports[direction] === transport) {
          delete active.transports[direction];
        }
        if (direction === 'send') {
          active.producer = undefined;
        } else {
          active.consumers.clear();
        }
        try {
          // Before the state that re-opens it, not after: the server permits one transport
          // per direction, so an effect reaching `createTransport` while it still holds this
          // one is refused with `transport_exists` and the rebuild dies there.
          await signalling(socket).closeTransport(transport.id);
        } catch (cause) {
          // The local transport is already closed, so a direction left holding its id here
          // would never reopen and never reach `failed` — no replacement, and no Reconnect
          // offered either. A refused `createTransport` is at least loud and retryable, and
          // a socket that never comes back voids this state wholesale on its next connect.
          console.error('media: could not release the transport server-side', cause);
        } finally {
          // Renegotiating, not in trouble. Left at `trouble` the link reads as down, `online`
          // is false, and the effects that would open the replacement decline to — the
          // rebuild would tear the transport down and nothing would ever ask for another.
          setHealth('connecting');
          setState((prev) => beginRebuild(prev, direction));
        }
      };

      const armIceRecovery = (next: TransportConnectionState): void => {
        const armed = active.iceRecoveryTimers[direction];
        if (armed !== undefined) {
          clearTimeout(armed);
          delete active.iceRecoveryTimers[direction];
        }
        if (session.current !== active || transport.closed) {
          return;
        }
        const attempts = active.iceRecoveryAttempts[direction] ?? 0;
        const connectedOnce = active.iceConnectedOnce[direction] ?? false;
        const delay = iceRecoveryDelay(next, attempts, connectedOnce);
        if (delay === null) {
          if (next === 'connected') {
            // The path this direction was fighting for is up; a later handoff starts over.
            active.iceRecoveryAttempts[direction] = 0;
            active.iceConnectedOnce[direction] = true;
            setHealth('connected');
            setReconnectRecommended(false);
            return;
          }
          if (iceRecoveryStep(attempts, next) === 'give-up') {
            setHealth('failed');
          } else {
            setHealth('trouble');
          }
          if (iceRecoveryStep(attempts, next) === 'give-up' && !gaveUp) {
            gaveUp = true;
            logIceRecovery(
              direction,
              `gave up after ${attempts} recovery attempts, still ${next}. ` +
                'Neither a restart nor a rebuild found a candidate the browser and the ' +
                'server can pair — an address family or a port neither side shares.',
            );
          }
          return;
        }

        if (active.pendingIceRestarts[direction]) {
          setHealth('trouble');
          return;
        }
        setHealth(next === 'failed' || attempts > 0 ? 'trouble' : 'connecting');

        active.iceRecoveryTimers[direction] = setTimeout(() => {
          delete active.iceRecoveryTimers[direction];
          if (session.current !== active || transport.closed) {
            return;
          }

          setHealth('trouble');
          const taken = active.iceRecoveryAttempts[direction] ?? 0;
          const step = iceRecoveryStep(taken, next);
          const attempt = taken + 1;
          active.iceRecoveryAttempts[direction] = attempt;

          const restart = (async () => {
            // Snapshot before either recovery, not after: what ICE was working with is the
            // question, and a fresh attempt has not had time to nominate anything.
            await reportTransportPath(transport, direction);
            if (step === 'rebuild') {
              await rebuild();
              return;
            }
            logIceRecovery(
              direction,
              `stuck in ${transport.connectionState} — restarting ICE (attempt ${attempt})`,
            );
            const { iceParameters } = await signalling(socket).restartIce(transport.id);
            const connectionState = transport.connectionState as TransportConnectionState;
            if (
              session.current !== active ||
              transport.closed ||
              connectionState === 'connected' ||
              connectionState === 'closed'
            ) {
              throw new Error(SUPERSEDED);
            }
            await transport.restartIce({ iceParameters });
            logIceRecovery(
              direction,
              `ICE restart ${attempt} applied, now ${transport.connectionState}`,
            );
          })();
          active.pendingIceRestarts[direction] = restart;
          void restart
            .catch((cause) => {
              if (session.current === active && !transport.closed && !isSuperseded(cause)) {
                console.error(`media: could not recover the transport (attempt ${attempt})`, cause);
              }
            })
            .finally(() => {
              if (active.pendingIceRestarts[direction] === restart) {
                delete active.pendingIceRestarts[direction];
              }
              if (session.current === active && !transport.closed) {
                armIceRecovery(transport.connectionState as TransportConnectionState);
              }
            });
        }, delay);
      };

      transport.on('connectionstatechange', armIceRecovery);

      active.transports[direction] = transport;
      setState((prev) => transportOpened(prev, direction, transport.id));
      armIceRecovery(transport.connectionState as TransportConnectionState);
      return transport;
    },
    [ensureSession, socket],
  );

  const startProducing = useCallback(
    async (slug: string, track: MediaStreamTrack, paused: boolean) => {
      const started = session.current?.pendingProducer;
      // Re-entering while the first produce is still in flight would close it and start
      // another, which the server broadcasts as the channel going offline and back on.
      if (started) {
        return started;
      }

      const produce = (async () => {
        const transport = await ensureTransport('send', slug);
        const active = session.current;
        if (!active) {
          throw new Error(SUPERSEDED);
        }

        active.producer?.close();
        // mediasoup-client forwards appData to the transport's produce callback, so the
        // server creates its Producer paused before its opened status is published.
        const producer = await transport.produce({
          track,
          ...PRODUCER_OPTIONS,
          appData: { paused },
        });
        // The server is already paused at this point; match the local sender before this
        // Producer is exposed to the studio.
        if (paused) {
          producer.pause();
        }
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
            if (session.current === active) {
              active.pendingProducer = undefined;
            }
          });
      }
      return produce;
    },
    [ensureTransport],
  );

  const stopProducing = useCallback(async () => {
    const active = session.current;
    const producer = active?.producer;
    if (!active || !producer || !socket) {
      return;
    }
    active.producer = undefined;
    producer.close();
    setState(producerClosed);
    await signalling(socket).closeProducer(producer.id);
  }, [socket]);

  /**
   * Swaps what the producer transmits without renegotiating. Needed because the capture
   * graph is rebuilt whenever the microphone changes: the old track belongs to an
   * AudioContext that is about to close, and a producer left holding it stays open and
   * transmits nothing — the channel reads live and is silent.
   */
  const replaceProducerTrack = useCallback(async (track: MediaStreamTrack) => {
    const producer = session.current?.producer;
    if (!producer || producer.closed) {
      return;
    }
    // Keeps the producer's paused state, so this cannot unmute anyone behind their back.
    await producer.replaceTrack({ track });
  }, []);

  const setProducerPaused = useCallback(
    async (paused: boolean) => {
      const producer = session.current?.producer;
      if (!producer || !socket) {
        return;
      }
      // Both directions discard the sample history, because differencing across the gap
      // would charge the silence to the line the moment audio came back. The rendered grade
      // is deliberately kept: muting is not a link event, so the last reading is still true
      // until the next poll replaces it, and dropping it flashes the line out of its bars.
      previousSample.current = null;

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

  const setLocalProducerPaused = useCallback(
    (paused: boolean, request: ProducerControlIdentity): boolean => {
      if (!canRollbackProducerControl(stateRef.current, request)) {
        return false;
      }
      const producer = session.current?.producer;
      if (!producer || producer.id !== request.producerId) {
        return false;
      }
      // History only, for the reason given in `setProducerPaused`.
      previousSample.current = null;
      if (paused && !producer.paused) {
        producer.pause();
      }
      if (!paused && producer.paused) {
        producer.resume();
      }
      return true;
    },
    [],
  );

  const startConsuming = useCallback(
    async (slug: string): Promise<MediaStreamTrack> => {
      const started = session.current?.pendingConsumers.get(slug);
      // The effect that drives this depends on the consumers map, which a close mutates
      // synchronously — so it re-enters while the first consume is still awaiting.
      if (started) {
        return started;
      }

      const consume = (async () => {
        const transport = await ensureTransport('recv');
        const active = session.current;
        if (!socket || !active) {
          throw new Error(SUPERSEDED);
        }

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

        watchConsumerTrack(consumer.track, slug);

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
            if (session.current === active) {
              active.pendingConsumers.delete(slug);
            }
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
      if (!active || !consumer || !socket) {
        return;
      }
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
    reconnectRecommended,
    stats,
    startProducing,
    stopProducing,
    replaceProducerTrack,
    setProducerPaused,
    setLocalProducerPaused,
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
export const PRODUCER_OPTIONS = {
  codecOptions: { opusStereo: false, opusFec: true, opusDtx: true },
  // mediasoup-client stops the track when the Producer closes unless told not to, and the
  // track belongs to the capture graph, which outlives any one broadcast: ending a
  // broadcast would leave the studio holding an ended track and every later produce would
  // throw. Releasing capture stays `src/lib/audio`'s single path.
  stopTracks: false,
} as const;
