import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { cn } from '@/lib/utils';

/**
 * The guest screens' header bar. It exists from `lg` only: on a phone the design gives the
 * content column the full height and no lockup, so this renders nothing there.
 *
 * `right` is the trailing slot the listener room fills with the event name and PIN — on a
 * phone that pair sits beside the back button instead, which is why it is a slot here and
 * not a pair of props.
 */
export function GuestHeader({ right, className }: { right?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'hidden items-center justify-between border-b border-border px-10 py-4 lg:flex',
        className,
      )}
    >
      <LogoLockup />
      {right}
    </header>
  );
}
