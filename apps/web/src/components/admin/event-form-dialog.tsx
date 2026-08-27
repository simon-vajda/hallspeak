import type { components } from '@linguacast/contract/openapi';
import { useNavigate } from '@tanstack/react-router';
import { EventForm } from '@/components/admin/event-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

/** Create and edit are the same dialog; pass an event to edit it. */
export function EventFormDialog({
  open,
  onOpenChange,
  mode,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: 'create'; event?: never } | { mode: 'edit'; event: AdminEventDetail })) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-105">
        {/* A child so it unmounts with the portal: every open starts from current values. */}
        <EventForm
          mode={mode}
          event={event}
          onSaved={(saved) => {
            onOpenChange(false);
            if (mode === 'create') {
              void navigate({ to: '/admin/events/$id', params: { id: saved.id } });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
