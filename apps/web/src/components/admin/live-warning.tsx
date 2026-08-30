import { CircleHelp, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The line a destructive admin dialog gains when the thing it is about to take down is on
 * air, or when the poll cannot say whether it is. Its callers decide whether it appears at
 * all. The two tones are not interchangeable: `live` is a stated fact and carries the
 * destructive weight, `unknown` is the page reporting its own blind spot and must not look
 * like a confirmed broadcast.
 */
export function LiveWarning({
  tone = 'live',
  children,
}: {
  tone?: 'live' | 'unknown';
  children: ReactNode;
}) {
  const live = tone === 'live';
  const Icon = live ? Radio : CircleHelp;

  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2.5',
        live ? 'bg-destructive-muted text-destructive' : 'bg-secondary text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
