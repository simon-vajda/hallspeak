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
import { eventQueryOptions } from '@/api/queries';
import type { AudioOutput } from '@/audio/use-audio-output';
import { useAudioOutput } from '@/audio/use-audio-output';
import type { ListenerVolume } from '@/audio/use-listener-volume';
import { useListenerVolume } from '@/audio/use-listener-volume';
import { DEFAULT_VOLUME_STATE } from '@/audio/volume';
import { useMedia } from '@/media/use-media';
import { CLIENT_VERSION } from '@/version';
import { type ChannelReports, resolveReports, sendReport } from './reports';
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
   * The guest's own level and where the audio is going. Owned here because the Audio sheet
   * is a separate route: two copies would disagree the moment either moved.
   */
  volume: ListenerVolume;
  output: AudioOutput;
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
  volume: {
    state: DEFAULT_VOLUME_STATE,
    setVolume: () => {},
    toggleMute: () => {},
  },
  output: { route: null, present: () => {} },
  reports: {
    sent: {},
    open: false,
    send: async () => ({ ok: false, message: 'No connection.' }),
    resolve: async () => ({ ok: false, message: 'No connection.' }),
  },
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

      if (outcome.ok) {
        setSent({});
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

  const volume = useListenerVolume();
  // Subscribed for as long as the event is open: a route change while the sheet is closed
  // is still the change the sheet must already know about when it opens.
  const output = useAudioOutput(true);

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
      volume,
      output,
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
      volume,
      output,
      reports,
    ],
  );

  return <EventSocketContext.Provider value={value}>{children}</EventSocketContext.Provider>;
}

export function useEventSocket(): EventSocket {
  return useContext(EventSocketContext);
}
