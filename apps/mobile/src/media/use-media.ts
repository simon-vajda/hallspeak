import type { MediaHealth } from '@linguacast/client-core/media';
import {
  afterConnect,
  beginRebuild,
  consumerClosed,
  consumerOpened,
  iceRecoveryDelay,
  iceRecoveryStep,
  initialMediaState,
  isCurrent,
  type MediaState,
  type MediaStats,
  type StatsSample,
  signalling,
  summarise,
  type TransportConnectionState,
  type TransportDirection,
  transportOpened,
} from '@linguacast/client-core/media';
import type { SocketClient } from '@linguacast/client-core/socket';
import type { types } from 'mediasoup-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDevice } from './device';
import { logIceRecovery, reportTransportPath, watchConsumerTrack } from './diagnostics';
import { inboundEntry } from './stats-entry';
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
}

/**
 * The shell around the platform's WebRTC APIs. Every decision it makes comes from the
 * shared media state; what lives here is the calls that need a real `RTCPeerConnection`
 * and cannot be tested without one. Receive-only: this app has no producer path.
 *
 * One session per socket connection. `connect` discards it wholesale rather than
 * reconciling — the server persists nothing, so a reconnection and a server restart are
 * the same event from here, and one path serves both.
 */
export function useMedia(socket: SocketClient | null) {
  const [state, setState] = useState<MediaState>(initialMediaState);
  const [health, setHealth] = useState<MediaHealth>('idle');
  /**
   * The ladder's candidates never paired, so this direction is not going to recover on its
   * own. The web client answers this by reloading the document, because Chromium keeps one
   * network view per page; React Native has no such scope and a fresh peer connection
   * re-enumerates interfaces, so what is offered here is a session restart instead.
   */
  const [restartRecommended, setRestartRecommended] = useState(false);
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
    // One release path: a partial teardown leaks a transport nothing will ever name again.
    for (const consumer of current.consumers.values()) {
      consumer.close();
    }
    for (const timer of Object.values(current.iceRecoveryTimers)) {
      clearTimeout(timer);
    }
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
      setRestartRecommended(false);
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
      setRestartRecommended(false);
      setStats(null);
    };
  }, [socket, releaseSession]);

  /**
   * Polled rather than pushed: WebRTC has no event for "the line got worse", and the
   * figures are cumulative anyway, so a sample on an interval is the shape they come in.
   */
  useEffect(() => {
    if (!state.recvTransportId) {
      setStats(null);
      previousSample.current = null;
      return;
    }

    const sample = async () => {
      const transport = session.current?.transports.recv;
      if (!transport || transport.closed) {
        return;
      }

      const report = await transport.getStats().catch(() => null);
      if (!report) {
        return;
      }

      const current = inboundEntry(report.values());
      if (!current) {
        return;
      }

      const summary = summarise(current, previousSample.current ?? undefined);
      previousSample.current = current;
      if (summary) {
        setStats(summary);
      }
    };

    void sample();
    const timer = setInterval(() => void sample(), STATS_POLL_MS);
    return () => clearInterval(timer);
  }, [state.recvTransportId]);

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

  const ensureTransport = useCallback(async (): Promise<types.Transport> => {
    const direction: TransportDirection = 'recv';
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
      iceServers: active.iceServers,
      onCandidateAddressFamilyMismatch: () => {
        if (session.current === active) {
          setRestartRecommended(true);
        }
      },
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
      logIceRecovery(`still ${transport.connectionState} — rebuilding the transport`);
      transport.close();
      if (active.transports[direction] === transport) {
        delete active.transports[direction];
      }
      active.consumers.clear();
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
          setRestartRecommended(false);
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
          await reportTransportPath(transport);
          if (step === 'rebuild') {
            await rebuild();
            return;
          }
          logIceRecovery(
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
          logIceRecovery(`ICE restart ${attempt} applied, now ${transport.connectionState}`);
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
  }, [ensureSession, socket]);

  const startConsuming = useCallback(
    async (slug: string): Promise<MediaStreamTrack> => {
      const started = session.current?.pendingConsumers.get(slug);
      // The effect that drives this depends on the consumers map, which a close mutates
      // synchronously — so it re-enters while the first consume is still awaiting.
      if (started) {
        return started;
      }

      const consume = (async () => {
        const transport = await ensureTransport();
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

  /**
   * Throws away every held identifier and renegotiates from capabilities. The socket is
   * cycled with it, because a reconnect is what the whole media layer treats as its reset:
   * the server persists nothing, so one path serves this and a server restart alike.
   */
  const restartSession = useCallback(() => {
    releaseSession();
    setRestartRecommended(false);
    socket?.disconnect();
    socket?.connect();
  }, [releaseSession, socket]);

  return {
    state,
    health,
    restartRecommended,
    stats,
    startConsuming,
    stopConsuming,
    restartSession,
    release: releaseSession,
  };
}

/** Often enough that a line going bad shows up within a sentence, cheap enough to ignore. */
const STATS_POLL_MS = 2_000;
