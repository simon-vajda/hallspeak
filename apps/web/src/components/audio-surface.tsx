import { ChevronDown } from 'lucide-react';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/** The `lg` breakpoint, as a media query rather than a class; see `useIsDesktop`. */
const DESKTOP = '(min-width: 64rem)';

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

/**
 * Shared trigger and responsive sheet/dialog chrome for audio settings. The surfaces are chosen,
 * not hidden by CSS: two mounted dialogs would create two focus traps and duplicate titles.
 */
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
  const desktop = useIsDesktop();
  const row = (
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
  );
  const trigger = cn(
    'hover:overlay flex w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-secondary px-5 py-3.25 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
    className,
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger className={trigger}>{row}</DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="grid-cols-[minmax(0,1fr)] p-panel sm:max-w-100"
        >
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <DialogTitle className="text-section">{title}</DialogTitle>
            <DialogClose className="cursor-pointer text-note font-semibold text-primary">
              Done
            </DialogClose>
          </div>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger className={trigger}>{row}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl px-panel pt-3.5 pb-6.5"
      >
        <span aria-hidden className="mx-auto mb-4.5 h-1 w-9.5 rounded-full bg-border" />
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <SheetTitle className="text-section">{title}</SheetTitle>
          <SheetClose className="cursor-pointer text-note font-semibold text-primary">
            Done
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Initial read and subscription match, so first paint mounts only correct surface. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}
