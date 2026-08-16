import { LevelMeter } from '@/components/level-meter';
import { cn } from '@/lib/utils';

/**
 * The pre-flight input-level card (`10f`, `10s`).
 *
 * The heading row — the `Input level` label and the status word beside it — belongs to
 * `LevelMeter`, which changes the word as the level crosses a threshold. The panel adds
 * only what sits around the bar: the design's `Quiet` / `Peak` end labels and the line that
 * says out loud that nothing is being transmitted yet.
 */
export function InputLevelPanel({
  analyser,
  className,
}: {
  analyser: AnalyserNode | null;
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

      <p className="mt-3.5 text-note text-muted-foreground">
        Speak at your normal volume — aim to sit just under the peak mark. Nobody hears you until
        you go live.
      </p>
    </section>
  );
}
