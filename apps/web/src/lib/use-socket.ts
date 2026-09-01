import type { ReportRow } from '@linguacast/contract/socket';
import { unwrap } from '@linguacast/contract/socket';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  applyJoinStatus,
  applyRealtimeStatus,
  beginChannelJoin,
  type ChannelStatusState,
  initialChannelStatuses,
  projectOnlineStatuses,
  resetStatusesForAuth,
  resetStatusOrdering,
} from '@/lib/channel-status';
import { connectSocket } from '@/lib/socket';
import { initialSocketConnectionState, socketConnectionState } from '@/lib/socket-state';
import type { SocketAuth, SocketClient } from '@/socket/client';

export type { SocketStatus } from '@/lib/socket-state';

/**
 * Callers pass `auth` only after their HTTP GET has returned 200, never in parallel with it:
 * in parallel, every mistyped PIN would open a socket and two error sources would race.
 * A first-connect error is therefore never a 404; it is version drift, channel_busy, or the
 * admin disabling the event in the gap. Retry errors stay in the reconnecting phase.
 */
export function useSocket(auth: SocketAuth | null) {
  const [{ status, error, hasConnected }, dispatchConnection] = useReducer(
    socketConnectionState,
    initialSocketConnectionState,
  );
  const [channelStatusState, setChannelStatusState] =
    useState<ChannelStatusState>(initialChannelStatuses);
  const [listeners, setListeners] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<Record<string, ReportRow[]>>({});
  // False until the connect-time tally lands. An empty window and one this socket has not
  // heard are different states, and only `No reports` may be printed for the first.
  const [reportsKnown, setReportsKnown] = useState(false);
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

  useEffect(() => {
    if (pin === null) {
      return;
    }

    updateChannelStatuses(resetStatusesForAuth);
    dispatchConnection({ type: 'start' });
    const s = connectSocket(speakerCode === null ? { pin } : { pin, speakerCode });
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
      // A tally from a dropped socket describes a channel nobody is updating, for the same
      // reason the counts go: the studio withholds rather than claiming an empty window.
      setReports({});
      setReportsKnown(false);
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
    s.on('channel:status', ({ slug, online: isOnline, muted, reason }) => {
      updateChannelStatuses((current) =>
        applyRealtimeStatus(current, slug, {
          online: isOnline,
          muted,
          ...(reason === undefined ? {} : { reason }),
        }),
      );
    });
    // Addressed to the speaker's socket alone, and sent once on connect, so a studio never
    // holds the `?? 0` fallback waiting for the first arrival or departure.
    s.on('channel:listeners', ({ slug, count }) => {
      setListeners((prev) => ({ ...prev, [slug]: count }));
    });
    // Sent once on connect whether or not there are rows, then on every change.
    s.on('channel:reports', ({ slug, rows }) => {
      setReports((prev) => ({ ...prev, [slug]: rows }));
      setReportsKnown(true);
    });

    return () => {
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      dispatchConnection({ type: 'stop' });
    };
  }, [pin, speakerCode, updateChannelStatuses]);

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
    reports,
    reportsKnown,
    socket,
    joinChannel,
    leaveChannel,
  };
}
