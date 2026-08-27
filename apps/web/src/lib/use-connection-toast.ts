import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SocketStatus } from '@/lib/use-socket';

/** A fixed id, so a second call can only ever replace the toast, never stack another. */
const TOAST_ID = 'socket-connection';

export function connectionToastMessage(status: SocketStatus, hasConnected: boolean): string | null {
  if (!hasConnected || status === 'idle' || status === 'connected') {
    return null;
  }
  return status === 'connecting' ? 'Reconnecting…' : 'Connection lost';
}

/**
 * Silent until the socket has connected once: the gap before the first connection is the page
 * still loading, which every screen already draws as its own not-yet-live state.
 */
export function useConnectionToast(status: SocketStatus) {
  const hasConnected = useRef(false);

  useEffect(() => {
    if (status === 'connected') {
      hasConnected.current = true;
      toast.dismiss(TOAST_ID);
      return;
    }

    const message = connectionToastMessage(status, hasConnected.current);
    if (!message) {
      return;
    }

    toast.loading(message, {
      id: TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
    });
  }, [status]);

  // A screen that unmounts while disconnected would otherwise leave the toast on the next
  // one, which has its own socket and may be perfectly connected.
  useEffect(
    () => () => {
      toast.dismiss(TOAST_ID);
    },
    [],
  );
}
