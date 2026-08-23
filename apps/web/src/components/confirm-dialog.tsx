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

/** Full width and 44px below `lg`, so they clear the minimum hit target. */
export const DIALOG_ACTION =
  'h-11 w-full rounded-full px-4.25 text-sm font-semibold lg:h-9.5 lg:w-auto';

/** The dialog type ramp, between the screen title and the section title. */
export const DIALOG_TITLE = 'text-[22px] leading-tight font-semibold tracking-[-0.03em]';
export const DIALOG_BODY = 'text-[13.5px] leading-[1.55]';

/** `flex-col-reverse` puts the primary on top. */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5.5 flex flex-col-reverse gap-2.5 lg:flex-row lg:justify-end">
      {children}
    </div>
  );
}

/**
 * `children` are the consequences, composed by the caller from live data. `tone: 'default'`
 * is for a confirmation that is consequential but not a deletion.
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
    <Dialog
      open={open}
      // Closing is refused mid-flight: the error line below is the only report a failure gets,
      // so dismissing early makes a failed destructive action look like one that worked.
      onOpenChange={(next) => {
        if (next || !pending) {
          onOpenChange(next);
        }
      }}
    >
      {/* No close cross: the two named buttons are the only ways out, so neither choice is
          made by accident. */}
      <DialogContent role="alertdialog" showCloseButton={false} className="sm:max-w-100">
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
          <DialogClose
            render={<Button variant="outline" disabled={pending} className={DIALOG_ACTION} />}
          >
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
