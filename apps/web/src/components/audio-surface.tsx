import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { ResponsiveSurface } from '@/components/responsive-surface';
import type { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Props = {
  icon: ReactNode;
  label: string;
  secondaryLabel: string;
  title: string;
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: ComponentProps<typeof Dialog>['onOpenChange'];
};

/** The settings row that opens the shared sheet-or-dialog chrome. */
export function AudioSurface({
  icon,
  label,
  secondaryLabel,
  title,
  children,
  className,
  open,
  onOpenChange,
}: Props) {
  return (
    <ResponsiveSurface
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      triggerClassName={cn(
        'hover:overlay flex w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-secondary px-5 py-3.25 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
      trigger={
        <>
          <span className="flex min-w-0 items-center gap-2.5">
            {icon}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-sm">{label}</span>
              <span className="block text-meta font-normal text-muted-foreground">
                {secondaryLabel}
              </span>
            </span>
          </span>
          <ChevronDown className="size-4.5 shrink-0 stroke-[2.25] text-muted-foreground" />
        </>
      }
    >
      {children}
    </ResponsiveSurface>
  );
}
