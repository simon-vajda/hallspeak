import type { ComponentProps, ReactNode } from 'react';
import { PlayTargetRing } from '@/components/play-target-ring';
import { cn } from '@/lib/utils';

/**
 * Named for the role, not the fill: `action` starts or stops your own audio, `live` is the
 * speaker's control while their mic is open, `danger` that same control once muted.
 */
const VARIANTS = {
  action: 'bg-primary text-primary-foreground border-2 border-primary',
  live: 'bg-card text-foreground border-2 border-foreground',
  danger: 'bg-destructive text-background border-2 border-destructive',
} as const;

/**
 * The round control at the centre of both public screens. `rings` means audio is flowing,
 * not connected: pass it only while samples are moving.
 */
export function PlayTarget({
  icon,
  label,
  iconOnly = false,
  variant = 'action',
  rings = false,
  muted = false,
  className,
  ...props
}: {
  icon: ReactNode;
  label: string;
  /** Compact listener control; speakers keep their visible state label. */
  iconOnly?: boolean;
  variant?: keyof typeof VARIANTS;
  rings?: boolean;
  /** Listener-only: let the existing rings settle when the interpreter mutes. */
  muted?: boolean;
} & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-full',
        // Sized here, so callers pass a bare lucide icon.
        '[&_svg]:pointer-events-none [&_svg]:stroke-[2.4]',
        iconOnly ? 'size-45 [&_svg]:size-13.5' : 'size-49 [&_svg]:size-9.75',
        'transition-transform duration-120 active:scale-96 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {iconOnly ? (
        <>
          <PlayTargetRing running={rings} settling={muted} />
          <PlayTargetRing running={rings} settling={muted} delayed />
        </>
      ) : (
        rings && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-ring rounded-full border-2 border-primary"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-ring-delayed rounded-full border-2 border-primary"
            />
          </>
        )
      )}
      {icon}
      {!iconOnly && (
        <span className="text-base leading-none font-semibold tracking-[-0.01em]">{label}</span>
      )}
    </button>
  );
}
