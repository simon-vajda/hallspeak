import { useEffect, useState } from 'react';
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
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [socket, setSocket] = useState<SocketClient | null>(null);

  // Destructured so the effect depends on the values, not on a fresh object identity.
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
