import { unwrap } from '@linguacast/contract/socket';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { SocketAuth, SocketClient } from '@/socket/client';

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Callers pass `auth` only after their HTTP GET has returned 200, never in parallel with it:
 * in parallel, every mistyped PIN would open a socket and two error sources would race.
 * A connect_error here is therefore never a 404; it is version drift, channel_busy, or the
 * admin disabling the event in the gap.
 */
export function useSocket(auth: SocketAuth | null) {
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [channelStatusState, setChannelStatusState] =
    useState<ChannelStatusState>(initialChannelStatuses);
  const [listeners, setListeners] = useState<Record<string, number>>({});
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
    setStatus('connecting');
    const s = connectSocket(speakerCode === null ? { pin } : { pin, speakerCode });
    setSocket(s);

    s.on('connect', () => {
      updateChannelStatuses(resetStatusOrdering);
      setStatus('connected');
      setError(null);
    });
    s.on('disconnect', (reason: string) => {
      // Counts are the server's to report and it can no longer report them: held through the
      // outage, the studio's tile would state an audience for a broadcast the server has
      // already reaped. `sendInitialListenerCount` re-seeds the real number on reconnect.
      setListeners({});
      // The server ends a session by disconnecting it and Socket.IO does not retry that,
      // so it is terminal, not a blip. Reported as such or the screen promises a recovery
      // that will never come.
      if (reason === 'io server disconnect') {
        setStatus('error');
        setError('session_ended');
        return;
      }
      setStatus('connecting');
    });
    s.on('connect_error', (err: Error) => {
      setStatus('error');
      setError(err.message);
    });
    s.on('channel:status', ({ slug, online: isOnline, muted }) => {
      updateChannelStatuses((current) =>
        applyRealtimeStatus(current, slug, { online: isOnline, muted }),
      );
    });
    // Addressed to the speaker's socket alone, and sent once on connect, so a studio never
    // holds the `?? 0` fallback waiting for the first arrival or departure.
    s.on('channel:listeners', ({ slug, count }) => {
      setListeners((prev) => ({ ...prev, [slug]: count }));
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setStatus('idle');
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
    online,
    channelStatuses: channelStatusState.channels,
    listeners,
    socket,
    joinChannel,
    leaveChannel,
  };
}
