import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
      <Switch size="lg" checked={checked} aria-label={label} onCheckedChange={onCheckedChange} />
      {failed && (
        <p role="status" className="text-right text-meta text-destructive">
          Could not save
        </p>
      )}
    </div>
  );
}
