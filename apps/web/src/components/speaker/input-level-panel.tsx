import type { ReactNode } from 'react';
import { LevelMeter } from '@/components/level-meter';
import { cn } from '@/lib/utils';

/**
 * The heading row belongs to `LevelMeter`, which owns the status word. `note` is per-screen
 * because the pre-flight line ("nobody hears you until you go live") is false once they have.
 */
export function InputLevelPanel({
  analyser,
  note,
  className,
}: {
  analyser: AnalyserNode | null;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg bg-secondary p-5', className)}>
      <LevelMeter analyser={analyser} />

      <div
        aria-hidden
        className="mt-2.25 flex justify-between text-label text-muted-foreground uppercase"
      >
        <span>Quiet</span>
        <span>Peak</span>
      </div>

      {note && <p className="mt-3.5 text-note text-muted-foreground">{note}</p>}
    </section>
  );
}
