import type { ChannelStatus, SentMap } from '@linguacast/client-core/channel';
import {
  initialMediaState,
  type MediaHealth,
  type MediaState,
  type MediaStats,
} from '@linguacast/client-core/media';
import {
  createSocket,
  type SocketAuth,
  type SocketClient,
  type SocketStatus,
  useSocket,
} from '@linguacast/client-core/socket';
import type { ReportCategory } from '@linguacast/contract/socket';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiOrigin } from '@/api/client';
import { eventQueryOptions, serverVersionQueryOptions } from '@/api/queries';
import type { SystemAudio } from '@/audio/use-system-audio';
import { useSystemAudio } from '@/audio/use-system-audio';
import { useMedia } from '@/media/use-media';
import { CLIENT_VERSION } from '@/version';
import { type ChannelReports, resolveReports, sendReport } from './reports';
import { type ServerCheck, serverCheck } from './server-check';
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
  /** The media leg. One session per connection, so it belongs to the same owner. */
  media: {
    state: MediaState;
    health: MediaHealth;
    stats: MediaStats | null;
    /** The ladder is spent: only a fresh session can recover this direction. */
    restartRecommended: boolean;
    startConsuming: (slug: string) => Promise<MediaStreamTrack>;
    stopConsuming: (slug: string) => Promise<void>;
    restartSession: () => void;
  };
  /**
   * Where the audio is going and how loud the device is, both read from the platform. Held
   * here rather than on the Channel screen because the Report sheet is a separate route and
   * its self-check reads the same level.
   */
  audio: SystemAudio;
  /**
   * Owned here rather than in the sheet, so closing and reopening it keeps the disable. The
   * server scopes both the cooldown and resolution eligibility to one connection, so this
   * clears whenever the connection does — a reconnect is a new one and carries neither.
   */
  reports: ChannelReports;
}

const IDLE: EventSocket = {
  status: 'idle',
  error: null,
  hasConnected: false,
  socket: null,
  channelStatuses: {},
  joinChannel: async () => {},
  leaveChannel: () => {},
  media: {
    state: initialMediaState,
    health: 'idle',
    stats: null,
    restartRecommended: false,
    startConsuming: () => Promise.reject(new Error('No socket.')),
    stopConsuming: async () => {},
    restartSession: () => {},
  },
  audio: { route: null, volume: 0 },
  reports: {
    sent: {},
    open: false,
    send: async () => ({ ok: false, message: 'No connection.' }),
    resolve: async () => ({ ok: false, message: 'No connection.' }),
  },
};

const EventSocketContext = createContext<EventSocket>(IDLE);

export interface ServerGate {
  check: ServerCheck;
  refreshing: boolean;
  recheck: () => void;
}

const ServerGateContext = createContext<ServerGate>({
  check: { state: 'checking' },
  refreshing: false,
  recheck: () => {},
});

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
  const version = useQuery({
    ...serverVersionQueryOptions(host),
    enabled,
    // One read per host for the life of the app. A version that moves under a running guest
    // is a server restart, which every socket here already recovers from on its own.
    staleTime: Number.POSITIVE_INFINITY,
  });

  const check = useMemo(
    () =>
      enabled
        ? serverCheck({
            info: version.data,
            failed: version.isError,
            mobileVersion: CLIENT_VERSION,
          })
        : ({ state: 'checking' } as ServerCheck),
    [enabled, version.data, version.isError],
  );

  const gate = useMemo<ServerGate>(
    () => ({
      check,
      refreshing: version.isRefetching,
      recheck: () => void version.refetch(),
    }),
    [check, version.isRefetching, version.refetch],
  );

  // The navigator stays mounted through every verdict. Rendering the failure in this
  // component's place would take the stack with it, leaving the guest on a screen with no
  // header and no way back; each screen renders the gate's message inside its own chrome.
  return (
    <ServerGateContext.Provider value={gate}>
      {check.state === 'ready' ? (
        <CompatibleEventSocketProvider host={host} pin={pin}>
          {children}
        </CompatibleEventSocketProvider>
      ) : (
        children
      )}
    </ServerGateContext.Provider>
  );
}

function CompatibleEventSocketProvider({
  host,
  pin,
  children,
}: {
  host: string;
  pin: string;
  children: ReactNode;
}) {
  const { data } = useQuery(eventQueryOptions(host, pin));

  // Bound to this event's host and independently versioned mobile artifact.
  const connect = useCallback(
    (auth: SocketAuth) => {
      const socket = createSocket({
        clientType: 'mobile',
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

  const {
    state: mediaState,
    health,
    stats,
    restartRecommended,
    startConsuming,
    stopConsuming,
    restartSession,
  } = useMedia(socket);

  const media = useMemo(
    () => ({
      state: mediaState,
      health,
      stats,
      restartRecommended,
      startConsuming,
      stopConsuming,
      restartSession,
    }),
    [mediaState, health, stats, restartRecommended, startConsuming, stopConsuming, restartSession],
  );

  const [sent, setSent] = useState<SentMap>({});
  const [reportOpen, setReportOpen] = useState(false);

  // A reconnect is a new connection, which the server gives a fresh cooldown and no episode
  // to resolve. The sheet's own disable clears with it rather than outliving what it described.
  useEffect(() => {
    if (status !== 'connected') {
      setSent({});
      setReportOpen(false);
    }
  }, [status]);

  const send = useCallback(
    async (slug: string, category: ReportCategory) => {
      const outcome = await sendReport(socket, slug, category);

      if (outcome.ok) {
        setSent((current) => ({ ...current, [category]: Date.now() }));
        setReportOpen(true);
      }

      return outcome;
    },
    [socket],
  );

  const resolve = useCallback(
    async (slug: string) => {
      const outcome = await resolveReports(socket, slug);

      // The episode closes; the cooldown does not. The server retains the hidden timestamps
      // of the categories this connection sent, so clearing them here would re-enable rows
      // it will still refuse.
      if (outcome.ok) {
        setReportOpen(false);
      }

      return outcome;
    },
    [socket],
  );

  const reports = useMemo(
    () => ({ sent, open: reportOpen, send, resolve }),
    [sent, reportOpen, send, resolve],
  );

  const audio = useSystemAudio();

  const value = useMemo(
    () => ({
      status,
      error,
      hasConnected,
      socket,
      channelStatuses,
      joinChannel,
      leaveChannel,
      media,
      audio,
      reports,
    }),
    [
      status,
      error,
      hasConnected,
      socket,
      channelStatuses,
      joinChannel,
      leaveChannel,
      media,
      audio,
      reports,
    ],
  );

  return <EventSocketContext.Provider value={value}>{children}</EventSocketContext.Provider>;
}

export function useEventSocket(): EventSocket {
  return useContext(EventSocketContext);
}

/** Read by both public screens: no event request may run before this reports `ready`. */
export function useServerGate(): ServerGate {
  return useContext(ServerGateContext);
}
