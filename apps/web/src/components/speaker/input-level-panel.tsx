import type { ReactNode } from 'react';
import { LevelMeter } from '@/components/level-meter';
import { cn } from '@/lib/utils';

/**
 * The input-level card, on both speaker screens (`10f`, `10s`, `10g`).
 *
 * The heading row — the `Input level` label and the status word beside it — belongs to
 * `LevelMeter`, which changes the word as the level crosses a threshold. The panel adds
 * only what sits around the bar: the design's `Quiet` / `Peak` end labels and whatever the
 * screen wants to say under them. `note` is per-screen because the pre-flight line ("nobody
 * hears you until you go live") is false once the interpreter has.
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
