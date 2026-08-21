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

      {/* Always rendered, hidden when empty: unmounting it makes the panel's height
          state-dependent, and muting would shift the mute target out from under a finger.
          One line's worth is reserved — the pre-flight note is longer and grows the panel,
          but that screen never toggles into this one. */}
      <p aria-hidden={!note} className="mt-3.5 text-note text-muted-foreground">
        {note ?? <span className="invisible">&nbsp;</span>}
      </p>
    </section>
  );
}
