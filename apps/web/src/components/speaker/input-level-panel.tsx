import { LevelMeter } from '@/components/level-meter';
import { MICRO_LABEL } from '@/components/micro-label';
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

      <div aria-hidden className={cn('mt-2.25 flex justify-between', MICRO_LABEL)}>
        <span>Quiet</span>
        <span>Peak</span>
      </div>
    </section>
  );
}
