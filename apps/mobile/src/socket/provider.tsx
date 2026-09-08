import type { ChannelStatus } from '@linguacast/client-core/channel';
import {
  createSocket,
  type SocketAuth,
  type SocketClient,
  type SocketStatus,
  useSocket,
} from '@linguacast/client-core/socket';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { apiOrigin } from '@/api/client';
import { eventQueryOptions } from '@/api/queries';
import { CLIENT_VERSION } from '@/version';
import { useAppStateReconnect } from './use-app-state-reconnect';

export interface EventSocket {
  status: SocketStatus;
  /** The handshake gate's refusal code, or null. Terminal: Socket.IO will not retry it. */
  error: string | null;
  hasConnected: boolean;
  socket: SocketClient | null;
  /** Socket-authoritative status per slug. Absent means this connection never read one. */
  channelStatuses: Record<string, ChannelStatus>;
  joinChannel: (slug: string, httpOnline: boolean) => Promise<void>;
  leaveChannel: (slug: string) => void;
}

const IDLE: EventSocket = {
  status: 'idle',
  error: null,
  hasConnected: false,
  socket: null,
  channelStatuses: {},
  joinChannel: async () => {},
  leaveChannel: () => {},
};

const EventSocketContext = createContext<EventSocket>(IDLE);

/**
 * One connection per event, opened here rather than on either screen. A stack navigator keeps
 * the Event screen mounted underneath the Channel screen, so a per-screen socket would hold
 * two connections to the same server; and the two sheets are separate routes that cannot be
 * handed a socket as a prop.
 */
export function EventSocketProvider({
  host,
  pin,
  children,
}: {
  host: string;
  pin: string;
  children: ReactNode;
}) {
  const enabled = host !== '' && pin !== '';
  const { data } = useQuery({ ...eventQueryOptions(host, pin), enabled });

  // Bound to this event's host. A version constant of its own, never the one in app.json.
  const connect = useCallback(
    (auth: SocketAuth) => {
      const socket = createSocket({
        clientVersion: CLIENT_VERSION,
        auth,
        url: apiOrigin(host),
      });
      socket.connect();
      return socket;
    },
    [host],
  );

  // `auth` only after the GET returned 200, never in parallel with it: in parallel every
  // mistyped PIN would open a socket and two error sources would race.
  const { status, error, hasConnected, channelStatuses, socket, joinChannel, leaveChannel } =
    useSocket(data ? { pin } : null, connect);

  useAppStateReconnect(socket);

  const value = useMemo(
    () => ({
      status,
      error,
      hasConnected,
      socket,
      channelStatuses,
      joinChannel,
      leaveChannel,
    }),
    [status, error, hasConnected, socket, channelStatuses, joinChannel, leaveChannel],
  );

  return <EventSocketContext.Provider value={value}>{children}</EventSocketContext.Provider>;
}

export function useEventSocket(): EventSocket {
  return useContext(EventSocketContext);
}
