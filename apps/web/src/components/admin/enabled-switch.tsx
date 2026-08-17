import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Enabled is not on air: `primary` marks what you can press and `live` that audio is moving,
 * so neither may stand in for it. Every admin enable control goes through here.
 */
export const ENABLED_TRACK = 'data-checked:bg-foreground';

/**
 * Stays live while the request is in flight: disabling it would flash for a round trip, and
 * the caller's optimistic update already shows the new state and rolls it back on failure.
 */
export function EnabledSwitch({
  checked,
  onCheckedChange,
  label,
  failed,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Names what is being enabled: "Enabled" alone tells a screen reader nothing. */
  label: string;
  failed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <Switch
        size="lg"
        checked={checked}
        className={ENABLED_TRACK}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
      {failed && (
        <p role="status" className="text-right text-meta text-destructive">
          Could not save
        </p>
      )}
    </div>
  );
}
