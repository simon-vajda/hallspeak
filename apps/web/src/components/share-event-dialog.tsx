import type { RefObject } from 'react';
import { EventShareCard } from '@/components/event-share-card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export type ShareEvent = { pin: string; eventName: string };

export function ShareEventDialog({
  share,
  open,
  onOpenChange,
  returnFocus,
}: {
  share: ShareEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        finalFocus={returnFocus}
        className="w-[calc(100%-var(--spacing-gutter)*2)] max-w-90 p-panel sm:max-w-90"
      >
        <DialogTitle className="pr-8 text-section">Share event</DialogTitle>
        <DialogDescription className="mb-5 pr-8 break-words">{share.eventName}</DialogDescription>
        <EventShareCard pin={share.pin} labelAs="h3" />
      </DialogContent>
    </Dialog>
  );
}
