import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/** The `lg` breakpoint, as a media query rather than a class; see `useIsDesktop`. */
const DESKTOP = '(min-width: 64rem)';

type Props = {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: ComponentProps<typeof Dialog>['onOpenChange'];
};

/**
 * A bottom sheet below `lg` and a centred dialog from it, with one `Done` action and one
 * title. The surfaces are chosen, not hidden by CSS: two mounted dialogs would create two
 * focus traps and duplicate titles.
 */
export function ResponsiveSurface({
  trigger,
  triggerClassName,
  title,
  children,
  open,
  onOpenChange,
}: Props) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
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
      <SheetTrigger className={triggerClassName}>{trigger}</SheetTrigger>
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
