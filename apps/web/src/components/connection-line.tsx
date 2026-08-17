import { useRef } from 'react';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

/**
 * The design's nine-bar waveform stands in for this line and returns with mediasoup; bars
 * with no audio pipeline behind them would be a static fake. `error` is already resolved to
 * human copy by the route. "Reconnecting" is only true of a connection that existed, which
 * is the one thing the socket state does not tell apart from a first attempt.
 */
export function ConnectionLine({
  status,
  error,
  className,
}: {
  status: SocketStatus;
  error?: string | null;
  className?: string;
}) {
  const hasConnected = useRef(false);
  if (status === 'connected') hasConnected.current = true;

  const text =
    status === 'error'
      ? (error ?? 'Connection failed.')
      : status === 'connected'
        ? 'Connected'
        : hasConnected.current
          ? 'Reconnecting…'
          : 'Connecting…';

  return (
    <p
      // Assertive would interrupt; this line changes on its own.
      aria-live="polite"
      className={cn('text-meta text-muted-foreground', className)}
    >
      {text}
    </p>
  );
}
