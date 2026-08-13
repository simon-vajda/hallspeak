import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Enabled is not the same thing as on air, so an enable switch's checked track is
 * `foreground` and never `primary` — `primary` marks what you can press and `live` marks
 * that audio is moving, and borrowing either to mean "enabled" is the ambiguity the
 * palette was rebuilt to remove. Every enable control in the admin goes through here so
 * that rule cannot drift one call site at a time.
 */
export const ENABLED_TRACK = 'data-checked:bg-foreground';

/** The switch as the design draws it, plus the failure line a save can leave behind. */
export function EnabledSwitch({
  checked,
  onCheckedChange,
  label,
  disabled,
  failed,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Names what is being enabled — "Enabled" alone tells a screen reader nothing. */
  label: string;
  disabled?: boolean;
  failed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <Switch
        size="lg"
        checked={checked}
        disabled={disabled}
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
