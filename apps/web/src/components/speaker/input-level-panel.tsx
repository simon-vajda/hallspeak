import { LevelMeter } from '@/components/level-meter';
import { cn } from '@/lib/utils';

/** The heading row belongs to `LevelMeter`, which owns the status word. */
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
    </section>
  );
}
