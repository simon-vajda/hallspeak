import { LevelMeter } from '@/components/level-meter';
import { cn } from '@/lib/utils';

/** The heading row belongs to `LevelMeter`, which owns the status word. */
export function InputLevelPanel({
  analyser,
  className,
  muted = false,
}: {
  analyser: AnalyserNode | null;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={cn('rounded-lg bg-secondary p-5', className)}>
      <LevelMeter analyser={analyser} muted={muted} />
    </section>
  );
}
