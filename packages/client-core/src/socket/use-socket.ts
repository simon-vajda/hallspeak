import { unwrap } from '@linguacast/contract/socket';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  type AnchoredListenerPoint,
  anchorListenerHistory,
  appendListenerCount,
} from '../channel/listener-history';
import {
  type AnchoredResolution,
  type AnchoredRow,
  anchorResolution,
  anchorRows,
} from '../channel/reports';
import {
  applyJoinStatus,
  applyRealtimeStatus,
  beginChannelJoin,
  type ChannelStatusState,
  initialChannelStatuses,
  projectOnlineStatuses,
  resetStatusesForAuth,
  resetStatusOrdering,
} from '../channel/status';
import type { SocketAuth, SocketClient } from './client';
import {
  type AnchoredHandover,
  anchorHandover,
  initialSocketConnectionState,
  socketConnectionState,
} from './state';

export type { AnchoredHandover, SocketStatus } from './state';

/** The four verbs a studio presses. None carries a payload; the server reads the caller. */
export type HandoverAction =
  | 'handover:request'
  | 'handover:cancel'
  | 'handover:confirm'
  | 'handover:take-over';

/** Opens a connected socket for `auth`. Each app binds its own client version and url. */
export type SocketFactory = (auth: SocketAuth) => SocketClient;

/**
 * Callers pass `auth` only after their HTTP GET has returned 200, never in parallel with it:
 * in parallel, every mistyped PIN would open a socket and two error sources would race.
 * A first-connect error is therefore never a 404; it is version drift, channel_busy, or the
 * admin disabling the event in the gap. Retry errors stay in the reconnecting phase.
 */
export function useSocket(auth: SocketAuth | null, connect: SocketFactory) {
  const [{ status, error, hasConnected }, dispatchConnection] = useReducer(
    socketConnectionState,
    initialSocketConnectionState,
  );
  const [channelStatusState, setChannelStatusState] =
    useState<ChannelStatusState>(initialChannelStatuses);
  const [listeners, setListeners] = useState<Record<string, number>>({});
  // A slug's absence means withheld: the snapshot arrives once when this studio gains the
  // claim, and until it does an empty series and a series nobody has sent are different
  // states. Only the first may be drawn; the second holds the panel back.
  const [listenerHistory, setListenerHistory] = useState<Record<string, AnchoredListenerPoint[]>>(
    {},
  );
  const [reports, setReports] = useState<Record<string, AnchoredRow[]>>({});
  const [reportResolutions, setReportResolutions] = useState<
    Record<string, AnchoredResolution | null>
  >({});
  // False until the connect-time tally lands. An empty window and one this socket has not
  // heard are different states, and only `No reports` may be printed for the first.
  const [reportsKnown, setReportsKnown] = useState(false);
  const [handover, setHandover] = useState<Record<string, AnchoredHandover>>({});
  // False until the connect-time snapshot lands, on the same terms as `reportsKnown`: a
  // channel nobody is waiting on and one this socket has not heard about are different
  // states, and only the first may be presented as nothing pending.
  const [handoverKnown, setHandoverKnown] = useState(false);
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const channelStatusRef = useRef(channelStatusState);
  channelStatusRef.current = channelStatusState;
  const online = useMemo(
    () => projectOnlineStatuses(channelStatusState.channels),
    [channelStatusState.channels],
  );

  const updateChannelStatuses = useCallback(
    (update: (current: ChannelStatusState) => ChannelStatusState) => {
      const next = update(channelStatusRef.current);
      channelStatusRef.current = next;
      setChannelStatusState(next);
    },
    [],
  );

  // Destructured so the effect depends on the values, not on a fresh object identity.
  const pin = auth?.pin ?? null;
  const speakerCode = auth?.speakerCode ?? null;
  const studioSession = auth?.studioSession ?? null;

  useEffect(() => {
    if (pin === null) {
      return;
    }

    updateChannelStatuses(resetStatusesForAuth);
    dispatchConnection({ type: 'start' });
    const s = connect({
      pin,
      ...(speakerCode === null ? {} : { speakerCode }),
      ...(studioSession === null ? {} : { studioSession }),
    });
    setSocket(s);

    s.on('connect', () => {
      updateChannelStatuses(resetStatusOrdering);
      dispatchConnection({ type: 'connect' });
    });
    s.on('disconnect', (reason: string) => {
      // Counts are the server's to report and it can no longer report them: held through the
      // outage, the studio's tile would state an audience for a broadcast the server has
      // already reaped. `sendInitialListenerCount` re-seeds the real number on reconnect.
      setListeners({});
      // The series goes with the counts that extend it: a chart held through the outage would
      // keep drawing an audience nobody is reporting, and the snapshot re-seeds it on reconnect.
      setListenerHistory({});
      // A tally from a dropped socket describes a channel nobody is updating, for the same
      // reason the counts go: the studio withholds rather than claiming an empty window.
      setReports({});
      setReportResolutions({});
      setReportsKnown(false);
      setHandover({});
      setHandoverKnown(false);
      // The server ends a session by disconnecting it and Socket.IO does not retry that,
      // so it is terminal, not a blip. Reported as such or the screen promises a recovery
      // that will never come.
      if (reason === 'io server disconnect') {
        dispatchConnection({ type: 'disconnect', reason });
        return;
      }
      dispatchConnection({ type: 'disconnect', reason });
    });
    s.on('connect_error', (err: Error) => {
      // Socket.IO keeps `active` true for retryable transport failures. A handshake
      // refusal destroys the socket and clears it, so promising another retry would lie.
      dispatchConnection({ type: 'connect-error', message: err.message, retryable: s.active });
    });
    const onReconnectAttempt = () => dispatchConnection({ type: 'reconnect-attempt' });
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.on(
      'channel:status',
      ({ slug, online: isOnline, muted, producerId, incomingProducerId, reason }) => {
        updateChannelStatuses((current) =>
          applyRealtimeStatus(current, slug, {
            online: isOnline,
            muted,
            producerId,
            incomingProducerId,
            ...(reason === undefined ? {} : { reason }),
          }),
        );
      },
    );
    // Addressed to the speaker's socket alone, and sent once on connect, so a studio never
    // holds the `?? 0` fallback waiting for the first arrival or departure.
    s.on('channel:listeners', ({ slug, count }) => {
      const now = Date.now();
      setListeners((prev) => ({ ...prev, [slug]: count }));
      // Extends a series this studio already holds and never starts one: a count arriving
      // before the snapshot would otherwise open a chart at that value, claiming the channel
      // had no earlier audience.
      setListenerHistory((prev) => {
        const current = prev[slug];
        if (current === undefined) {
          return prev;
        }
        const next = appendListenerCount(current, count, now);
        return next === current ? prev : { ...prev, [slug]: next };
      });
    });
    // Sent once to the studio that gains the claim; the series is extended from
    // `channel:listeners` afterwards, never from a second snapshot.
    s.on('channel:listener-history', ({ slug, points }) => {
      // Anchored here rather than at render: each point's `ageMs` is only true at receipt.
      setListenerHistory((prev) => ({
        ...prev,
        [slug]: anchorListenerHistory(points, Date.now()),
      }));
    });
    // Sent once on connect whether or not there are rows, then on every change.
    s.on('channel:reports', ({ slug, rows, soundsGood }) => {
      // Anchored here rather than at render: the wire's `ageMs` is only true at receipt, so
      // re-deriving it later would reset every row to "just now".
      const now = Date.now();
      setReports((prev) => ({ ...prev, [slug]: anchorRows(rows, now) }));
      setReportResolutions((prev) => ({
        ...prev,
        [slug]: anchorResolution(soundsGood, now),
      }));
      setReportsKnown(true);
    });
    // Sent unconditionally on connect and again on every claim or handover change.
    s.on('handover:state', (state) => {
      // Anchored here rather than at render: `remainingMs` is only true at receipt.
      setHandover((prev) => ({ ...prev, [state.slug]: anchorHandover(state, Date.now()) }));
      setHandoverKnown(true);
      if (state.holder === 'self') {
        return;
      }
      // The audience and the tally belong to whoever holds the claim. A studio that does not
      // hold it receives neither, so holding the last values would state an audience for a
      // broadcast that is no longer this studio's, and clearing them alone would present an
      // empty window this socket is not being told about.
      setListeners((prev) => {
        const { [state.slug]: _gone, ...rest } = prev;
        return rest;
      });
      setListenerHistory((prev) => {
        const { [state.slug]: _gone, ...rest } = prev;
        return rest;
      });
      setReports((prev) => {
        const { [state.slug]: _gone, ...rest } = prev;
        return rest;
      });
      setReportResolutions((prev) => {
        const { [state.slug]: _gone, ...rest } = prev;
        return rest;
      });
      setReportsKnown(false);
    });

    return () => {
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      dispatchConnection({ type: 'stop' });
    };
  }, [pin, speakerCode, studioSession, connect, updateChannelStatuses]);

  const joinChannel = useCallback(
    async (slug: string, httpOnline: boolean) => {
      if (!socket) {
        throw new Error('No socket.');
      }

      const started = beginChannelJoin(channelStatusRef.current, slug, httpOnline);
      channelStatusRef.current = started.state;
      setChannelStatusState(started.state);

      const snapshot = unwrap(await socket.emitWithAck('channel:join', { slug }));
      updateChannelStatuses((current) => applyJoinStatus(current, started.ticket, snapshot));
    },
    [socket, updateChannelStatuses],
  );

  const emitHandover = useCallback(
    async (action: HandoverAction) => {
      if (!socket) {
        throw new Error('No socket.');
      }
      unwrap(await socket.emitWithAck(action, {}));
    },
    [socket],
  );

  const requestHandover = useCallback(() => emitHandover('handover:request'), [emitHandover]);
  const cancelHandover = useCallback(() => emitHandover('handover:cancel'), [emitHandover]);
  const confirmHandover = useCallback(() => emitHandover('handover:confirm'), [emitHandover]);
  const takeOver = useCallback(() => emitHandover('handover:take-over'), [emitHandover]);

  const leaveChannel = useCallback(
    (slug: string) => {
      socket?.emit('channel:leave', { slug });
    },
    [socket],
  );

  return {
    status,
    error,
    hasConnected,
    online,
    channelStatuses: channelStatusState.channels,
    listeners,
    listenerHistory,
    reports,
    reportResolutions,
    reportsKnown,
    handover,
    handoverKnown,
    socket,
    joinChannel,
    leaveChannel,
    requestHandover,
    cancelHandover,
    confirmHandover,
    takeOver,
  };
}
