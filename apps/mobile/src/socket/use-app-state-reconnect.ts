import type { SocketClient } from '@linguacast/client-core/socket';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { type AppStatus, shouldReconnectOnForeground } from './reconnect';

/** Reopens a connection the operating system suspended, without the guest pressing anything. */
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
}
