import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Call-site sizing for a dialog action button. The design draws them 38px and right-aligned;
 * below `lg` they go full width and stacked, and 44px so they clear the minimum hit target.
 */
export const DIALOG_ACTION =
  'h-11 w-full rounded-full px-4.25 text-sm font-semibold lg:h-9.5 lg:w-auto';

/** The dialog type ramp, which sits between the screen title and the section title. */
export const DIALOG_TITLE = 'text-[22px] leading-tight font-semibold tracking-[-0.03em]';
export const DIALOG_BODY = 'text-[13.5px] leading-[1.55]';

/** Shell for a dialog panel: the design's card radius and the screen gutter as padding. */
export const DIALOG_PANEL = 'gap-0 rounded-lg p-gutter';

/** The action row every dialog ends with. `flex-col-reverse` puts the primary on top. */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5.5 flex flex-col-reverse gap-2.5 lg:flex-row lg:justify-end">
      {children}
    </div>
  );
}

/**
 * A confirmation before an action that cannot be taken back. `children` are the consequences
 * — the caller composes them from live data, because "three channels go with it" is the part
 * that makes the admin stop and read.
 *
 * `tone` is `destructive` by default; `default` is for confirmations that are consequential
 * but not a deletion, and swaps the red badge and button for the ordinary primary.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  tone = 'destructive',
  icon,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: 'destructive' | 'default';
  icon: ReactNode;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  const destructive = tone === 'destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No close cross: the two named buttons are the only ways out, so neither choice can
          be made by accident. Escape and the backdrop still cancel. */}
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className={cn(DIALOG_PANEL, 'sm:max-w-100')}
      >
        <div
          aria-hidden="true"
          className={cn(
            'mb-4 flex size-11 items-center justify-center rounded-full',
            destructive ? 'bg-destructive-muted text-destructive' : 'bg-secondary text-foreground',
          )}
        >
          {icon}
        </div>

        <DialogTitle className={cn('mb-1.5', DIALOG_TITLE)}>{title}</DialogTitle>
        {/* A div, not the default paragraph: callers pass more than one line. */}
        <DialogDescription render={<div />} className={cn('flex flex-col gap-2', DIALOG_BODY)}>
          {children}
        </DialogDescription>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogActions>
          <DialogClose render={<Button variant="outline" className={DIALOG_ACTION} />}>
            {cancelLabel}
          </DialogClose>
          <Button
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              DIALOG_ACTION,
              destructive && 'bg-destructive text-background hover:bg-destructive/90',
            )}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
