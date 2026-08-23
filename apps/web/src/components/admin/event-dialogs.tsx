import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { KeyRound, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { $api } from '@/api/client';
import { ConfirmDialog, DialogActions } from '@/components/confirm-dialog';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { eventDetailKey, eventsListKey, invalidateAdminEvents } from '@/lib/admin-queries';
import { type EventFormValues, eventFormSchema } from '@/lib/event-form';
import { formatPin, plural } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

/** Create and edit are the same dialog; pass an `event` to edit it. */
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
            // A new event has a PIN and nothing else, so adding channels is the next act.
            if (mode === 'create') {
              navigate({ to: '/admin/events/$id', params: { id: saved.id } });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  mode,
  event,
  onSaved,
}: {
  mode: 'create' | 'edit';
  event?: AdminEventDetail;
  onSaved: (saved: AdminEventDetail) => void;
}) {
  const creating = mode === 'create';
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const switchLabelId = useId();
  const switchDescriptionId = useId();

  const {
    register,
    control,
    handleSubmit,
    // Not either mutation's isPending: those go false the moment the request resolves,
    // reopening the button for a second save during the invalidation that follows.
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name ?? '',
      description: event?.description ?? '',
      enabled: event?.enabled ?? false,
    },
    mode: 'onSubmit',
  });

  const create = $api.useMutation('post', '/admin/events');
  const update = $api.useMutation('patch', '/admin/events/{id}');

  const onSubmit = handleSubmit(async (values) => {
    setFailed(false);
    const body = {
      name: values.name,
      description: values.description === '' ? null : values.description,
      enabled: values.enabled,
    };

    try {
      const saved = event
        ? await update.mutateAsync({ params: { path: { id: event.id } }, body })
        : await create.mutateAsync({ body });
      await invalidateAdminEvents(queryClient, saved.id);
      onSaved(saved);
    } catch {
      // Left open: closing here would throw away what the admin typed.
      setFailed(true);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle className="mb-1.5">{creating ? 'New event' : 'Edit event'}</DialogTitle>
      <DialogDescription className="mb-5">
        {creating
          ? 'A PIN is generated when you save. The event stays disabled until you switch it on.'
          : 'The PIN and the channels are untouched — only what is below changes.'}
      </DialogDescription>

      <div className="flex flex-col gap-3.5">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="event-name" className={MICRO_LABEL}>
            Name
          </FieldLabel>
          <Input
            id="event-name"
            autoComplete="off"
            placeholder="Sunday Service"
            aria-invalid={errors.name ? true : undefined}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="event-description" className={MICRO_LABEL}>
            Description
          </FieldLabel>
          <Textarea
            id="event-description"
            rows={3}
            placeholder="Morning gathering, main hall."
            aria-invalid={errors.description ? true : undefined}
            className="min-h-19 rounded-md bg-secondary px-4 py-3 leading-normal"
            {...register('description')}
          />
          <FieldError errors={[errors.description]} />
        </Field>

        <Field
          orientation="horizontal"
          className="rounded-lg border border-border bg-secondary px-4 py-3"
        >
          <FieldContent>
            <FieldTitle id={switchLabelId} className="text-sm font-semibold">
              {creating ? 'Enable straight away' : 'Enabled'}
            </FieldTitle>
            <FieldDescription id={switchDescriptionId} className="text-note">
              {creating
                ? 'Guests can join as soon as it exists'
                : 'Guests can join while this is on'}
            </FieldDescription>
          </FieldContent>
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <Switch
                size="lg"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-labelledby={switchLabelId}
                aria-describedby={switchDescriptionId}
              />
            )}
          />
        </Field>
      </div>

      {failed && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {creating
            ? 'Could not create the event. Nothing was saved — try again.'
            : 'Could not save your changes. The event is as it was — try again.'}
        </p>
      )}

      <DialogActions>
        <DialogClose render={<Button variant="outline" size="action" />}>Cancel</DialogClose>
        <Button type="submit" size="action" disabled={isSubmitting}>
          {creating ? 'Create event' : 'Save changes'}
        </Button>
      </DialogActions>
    </form>
  );
}

export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: AdminEventDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Awaited before the cache is touched, so a navigating caller can unmount first. */
  onDeleted?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('delete', '/admin/events/{id}', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      // Leave the page before touching the cache: invalidating the detail query while its
      // route is mounted refetches a deleted event and flashes not-found on the way out.
      // The await is what makes the ordering real; navigate() resolves once it commits.
      onOpenChange(false);
      await onDeleted?.();
      queryClient.removeQueries({ queryKey: eventDetailKey(event.id) });
      await queryClient.invalidateQueries({ queryKey: eventsListKey() });
    },
    onError: () => setFailed(true),
  });

  const channels = event.channels.length;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="size-5" />}
      title={`Delete ${event.name}?`}
      confirmLabel="Delete"
      cancelLabel="Keep event"
      pending={isPending}
      error={failed ? 'Could not delete the event. Nothing was removed — try again.' : undefined}
      onConfirm={() => mutate({ params: { path: { id: event.id } } })}
    >
      <p>
        {channels > 0 && `Its ${plural(channels, 'channel')} go with it, and `}
        PIN {formatPin(event.pin)} stops working immediately. Anyone listening right now will be
        disconnected.
      </p>
      <p>This cannot be undone.</p>
    </ConfirmDialog>
  );
}

/** Neutral tone: regenerating destroys nothing, it only invalidates what is already printed. */
export function RegeneratePinDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Pick<AdminEventDetail, 'id' | 'pin'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('post', '/admin/events/{id}/regenerate-pin', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      // Close first: the refetch swaps in the new PIN, and the body names the old one.
      onOpenChange(false);
      await invalidateAdminEvents(queryClient, event.id);
    },
    onError: () => setFailed(true),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<KeyRound className="size-5" />}
      title="Generate a new PIN?"
      confirmLabel="Generate new PIN"
      cancelLabel="Keep this PIN"
      pending={isPending}
      error={
        failed ? 'Could not generate a new PIN. The old one still works — try again.' : undefined
      }
      onConfirm={() => mutate({ params: { path: { id: event.id } } })}
    >
      <p>
        PIN {formatPin(event.pin)} stops working the moment the new one exists. Any cards or QR
        codes already printed with it have to be reprinted.
      </p>
      <p>Anyone listening now will be disconnected and will have to rejoin with the new PIN.</p>
    </ConfirmDialog>
  );
}
