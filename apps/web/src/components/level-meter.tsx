import { useEffect, useRef, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import {
  holdPeak,
  type LevelStatus,
  levelStatus,
  meterLevel,
  rms,
  smoothLevel,
} from '@/lib/audio/level';
import { cn } from '@/lib/utils';

const STATUS_TEXT: Record<LevelStatus, string> = {
  quiet: 'Too quiet',
  good: 'Sounds good',
  peaking: 'Peaking — lower the gain',
};

const STATUS_TONE: Record<LevelStatus, string> = {
  quiet: 'text-muted-foreground',
  good: 'text-live-on-muted',
  peaking: 'text-destructive',
};

/**
 * The fill's width, the peak marker and the peaking colour are written to the DOM every frame
 * and never go through React, which would re-render the screen around the meter too. Only the
 * status label is state. `analyser` is null until the mic is open, and the bar then sits empty.
 *
 * The bar is smoothed and the marker is not: the words and the colour follow the marker, so a
 * plosive that clips for 30ms is still reported, and the interpreter can see what reported it.
 */
export function LevelMeter({
  analyser,
  className,
}: {
  analyser: AnalyserNode | null;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<LevelStatus>('quiet');

  useEffect(() => {
    const fill = fillRef.current;
    if (!analyser || !fill) {
      return;
    }

    const frame = new Float32Array(analyser.fftSize);
    let raf = 0;
    let last: LevelStatus | null = null;
    let smoothed = 0;
    let peak = 0;
    let lastTimestamp = 0;

    // rAF's own timestamp, not `performance.now()`: a frame the browser coalesced then carries
    // the time it actually stood for rather than the time it was finally delivered.
    const read = (timestamp: number) => {
      const elapsed = lastTimestamp === 0 ? 0 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      analyser.getFloatTimeDomainData(frame);
      const level = meterLevel(rms(frame));
      smoothed = smoothLevel(smoothed, level, elapsed);
      peak = holdPeak(peak, level, elapsed);

      fill.style.width = `${smoothed * 100}%`;
      if (peakRef.current) {
        peakRef.current.style.left = `${peak * 100}%`;
      }

      const next = levelStatus(peak);
      rootRef.current?.setAttribute('data-peaking', String(next === 'peaking'));
      if (next !== last) {
        last = next;
        setStatus(next);
      }

      raf = requestAnimationFrame(read);
    };
    raf = requestAnimationFrame(read);

    return () => {
      cancelAnimationFrame(raf);
      // The readout and the peaking colour are as stale as the bar once the analyser is gone.
      fill.style.width = '0%';
      if (peakRef.current) {
        peakRef.current.style.left = '0%';
      }
      rootRef.current?.setAttribute('data-peaking', 'false');
      setStatus('quiet');
    };
  }, [analyser]);

  return (
    <div ref={rootRef} data-peaking="false" className={cn('group flex flex-col', className)}>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className={MICRO_LABEL}>Input level</span>
        <span role="status" className={cn('text-meta font-semibold', STATUS_TONE[status])}>
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="relative h-3.5 lg:h-4.5">
        <div className="h-full overflow-hidden rounded-full bg-border">
          <div
            ref={fillRef}
            className="h-full w-0 rounded-full bg-live group-data-[peaking=true]:bg-destructive"
          />
        </div>
        <div
          ref={peakRef}
          className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground/60"
        />
        {/* The clip threshold, drawn at PEAK_THRESHOLD. */}
        <div className="absolute -inset-y-1.25 left-[85%] w-0.5 rounded-[1px] bg-foreground/35" />
      </div>
    </div>
  );
}
