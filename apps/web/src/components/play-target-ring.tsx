import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SETTLE_MS = 280;

/** A listener ring keeps its CSS phase while a mute transition brings it to rest. */
export function PlayTargetRing({
  running,
  settling,
  delayed = false,
}: {
  running: boolean;
  settling: boolean;
  delayed?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const transition = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      const pulses = element
        .getAnimations()
        .filter((animation) => animation !== transition.current);
      if (reduceMotion.matches || (!running && !settling)) {
        transition.current?.cancel();
        transition.current = null;
        for (const pulse of pulses) {
          pulse.pause();
          pulse.currentTime = 0;
        }
        element.style.visibility = running ? 'visible' : 'hidden';
        return;
      }

      if (running) {
        element.style.visibility = 'visible';
        const exit = transition.current;
        if (exit) {
          // Reverse from the currently displayed frame, even if unmuted halfway through
          // shrinking. Resume the frozen pulse only after reaching its original size.
          exit.onfinish = () => {
            if (transition.current !== exit) {
              return;
            }
            exit.cancel();
            transition.current = null;
            for (const pulse of pulses) {
              pulse.play();
            }
          };
          exit.updatePlaybackRate(-1);
          exit.play();
        } else {
          for (const pulse of pulses) {
            pulse.play();
          }
        }
        return;
      }

      for (const pulse of pulses) {
        pulse.pause();
      }
      if (transition.current) {
        // Muted again during the return: turn the same transition around without a jump.
        transition.current.onfinish = null;
        transition.current.updatePlaybackRate(1);
        transition.current.play();
      } else if (element.style.visibility !== 'hidden') {
        const frame = getComputedStyle(element);
        transition.current = element.animate(
          [
            { transform: frame.transform, opacity: frame.opacity },
            { transform: 'scale(1)', opacity: 0 },
          ],
          { duration: SETTLE_MS, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' },
        );
      }
    };

    update();
    reduceMotion.addEventListener('change', update);
    return () => reduceMotion.removeEventListener('change', update);
  }, [running, settling]);

  useLayoutEffect(
    () => () => {
      transition.current?.cancel();
      transition.current = null;
    },
    [],
  );

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 rounded-full border-2 border-primary opacity-0',
        delayed ? 'animate-ring-delayed' : 'animate-ring',
      )}
    />
  );
}
