import type { SocketClient } from '@hallspeak/client-core/socket';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useNetworkChange, useSessionTick } from '@/audio/use-session-tick';
import { type AppStatus, shouldReconnectOnForeground, shouldReconnectOnTick } from './reconnect';

/**
 * Reopens a connection the operating system suspended, without the guest pressing anything.
 *
 * Three signals, because none covers the others: returning to the foreground catches a
 * process that was suspended outright; the listening session's heartbeat catches a link
 * dropped behind a locked screen, where Socket.IO's own retry timer is not being serviced;
 * and a network change is the cause itself, which is worth acting on rather than waiting to
 * infer from a deadline the connection it broke will never answer.
 */
export function useAppStateReconnect(socket: SocketClient | null): void {
  const previous = useRef<AppStatus>(AppState.currentState as AppStatus);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const subscription = AppState.addEventListener('change', (next) => {
      const decision = shouldReconnectOnForeground({
        previous: previous.current,
        next: next as AppStatus,
        connected: socket.connected,
      });
      previous.current = next as AppStatus;

      if (decision) {
        socket.connect();
      }
    });

    return () => subscription.remove();
  }, [socket]);

  useSessionTick(() => {
    if (socket && shouldReconnectOnTick({ connected: socket.connected })) {
      socket.connect();
    }
  });

  // Cycled rather than reconnected: a socket over the network the device just left still
  // reports itself connected, and only a deliberate close makes the loss real. The media
  // session follows, because `connect` is what the whole media layer treats as its reset.
  useNetworkChange(() => {
    socket?.disconnect();
    socket?.connect();
  });
}
