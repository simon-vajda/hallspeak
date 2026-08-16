import { useEffect, useState } from 'react';
import { connectSocket } from '@/lib/socket';
import type { SocketAuth, SocketClient } from '@/socket/client';

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Opens a socket once `auth` is non-null — which callers pass only after their HTTP
 * GET has returned 200.
 *
 * Never in parallel with that GET: validity is not knowable until it answers, so
 * firing both at once would open a socket for every mistyped PIN, which is exactly the
 * load the policy exists to prevent, and would leave two error sources racing to
 * render conflicting states (spec E §7).
 *
 * A connect_error here is therefore NEVER a 404 — the codes were just validated. It
 * means version drift, channel_busy, or the admin disabling the event in the gap.
 *
 * Under StrictMode this effect runs twice in dev, so the socket connects, disconnects
 * and reconnects on mount. That is expected and harmless.
 */
export function useSocket(auth: SocketAuth | null) {
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [socket, setSocket] = useState<SocketClient | null>(null);

  // Destructured so the effect depends on the values, not on a fresh object identity
  // every render.
  const pin = auth?.pin ?? null;
  const speakerCode = auth?.speakerCode ?? null;

  useEffect(() => {
    if (pin === null) return;

    setStatus('connecting');
    const s = connectSocket(speakerCode === null ? { pin } : { pin, speakerCode });
    setSocket(s);

    s.on('connect', () => {
      setStatus('connected');
      setError(null);
    });
    s.on('disconnect', () => setStatus('connecting'));
    s.on('connect_error', (err: Error) => {
      setStatus('error');
      setError(err.message);
    });
    s.on('channel:status', ({ slug, online: isOnline }) => {
      setOnline((prev) => ({ ...prev, [slug]: isOnline }));
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setStatus('idle');
    };
  }, [pin, speakerCode]);

  return { status, error, online, socket };
}
