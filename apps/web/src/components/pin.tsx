import { formatPin } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A PIN shown as digits to read off a screen or a card: grouped 3+3 and tracked out, from one
 * place. A PIN inside a sentence is not this — prose already separates it, so those callers
 * keep `formatPin` directly.
 */
export function Pin({ pin, className }: { pin: string; className?: string }) {
  return <span className={cn('tracking-[0.04em]', className)}>{formatPin(pin)}</span>;
}
