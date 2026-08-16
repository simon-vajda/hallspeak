import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

/**
 * The one-line status readout under the play target.
 *
 * The canvas draws a nine-bar waveform and "Good connection" in this slot. There is no
 * audio pipeline yet, so bars would be a picture of a signal that does not exist — a
 * static fake. The slot keeps its position and its `text-meta` treatment and reports the
 * one thing that is real: the socket. The waveform returns with mediasoup.
 *
 * `error` is already resolved to human copy by the route, which owns the code→message map.
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
  const text =
    status === 'error'
      ? (error ?? 'Connection failed.')
      : status === 'connected'
        ? 'Connected'
        : 'Reconnecting…';

  return (
    <p
      // Assertive would interrupt; this line changes on its own and only needs to be read.
      aria-live="polite"
      className={cn('text-meta text-muted-foreground', className)}
    >
      {text}
    </p>
  );
}
