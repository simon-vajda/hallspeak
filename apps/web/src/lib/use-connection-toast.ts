import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SocketStatus } from '@/lib/use-socket';

/** A fixed id, so a second call can only ever replace the toast, never stack another. */
const TOAST_ID = 'socket-connection';

/**
 * How long the socket may be away before it is worth telling anyone. Under StrictMode the
 * socket disconnects and immediately reconnects on mount, and a real network blip is often
 * shorter than this too — a toast for either is noise.
 */
const GRACE_MS = 700;

/**
 * Reports a lost socket as a toast, and clears it on reconnect.
 *
 * It lives with the screens rather than in `useSocket` because that hook is a data source
 * and presentation is not its job — the same reason it returns `status` instead of copy.
 *
 * Silent until the socket has connected once: the gap before the first connection is the
 * page still loading, and every screen already draws that as its own not-yet-live state.
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
