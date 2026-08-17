import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SocketStatus } from '@/lib/use-socket';

/** A fixed id, so a second call can only ever replace the toast, never stack another. */
const TOAST_ID = 'socket-connection';

/**
 * How long the socket may be away before it is worth telling anyone. A StrictMode remount and
 * a real network blip are both shorter than this, and a toast for either is noise.
 */
const GRACE_MS = 700;

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

    if (!hasConnected.current || status === 'idle') return;

    const timer = setTimeout(() => {
      toast.loading(status === 'error' ? 'Connection lost' : 'Reconnecting…', {
        id: TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
      });
    }, GRACE_MS);

    return () => clearTimeout(timer);
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
