import { ArrowLeftRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function HandoverAlert({
  tone,
  title,
  note,
  children,
  trailing,
  className,
}: {
  tone: 'warn' | 'neutral';
  title: string;
  note: string;
  /** Under the note, inside the text column. */
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-live="polite"
      className={cn(
        'flex gap-3.5 rounded-lg border p-4 sm:items-center sm:gap-4 sm:pr-4.5 sm:pl-5',
        tone === 'neutral'
          ? 'border-transparent bg-secondary text-foreground'
          : 'border-warn-border bg-warn-muted text-warn-on-muted',
        className,
      )}
    >
      <ArrowLeftRight aria-hidden className="mt-0.5 size-5 shrink-0 stroke-[2.25] sm:mt-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="mt-0.5 text-note text-muted-foreground">{note}</p>
          {children}
        </div>
        {trailing}
      </div>
    </section>
  );
}
