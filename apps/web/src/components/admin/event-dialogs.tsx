import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { KeyRound, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { $api } from '@/api/client';
import {
  ConfirmDialog,
  DIALOG_ACTION,
  DIALOG_BODY,
  DIALOG_PANEL,
  DIALOG_TITLE,
  DialogActions,
} from '@/components/admin/confirm-dialog';
import { ENABLED_TRACK } from '@/components/admin/enabled-switch';
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
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

const LABEL = 'text-label text-muted-foreground uppercase';
const TEXT_INPUT = 'bg-secondary text-sm';

/**
 * Create and edit are the same dialog: only the heading, the primary label, the initial
 * values and the mutation differ. Pass an `event` to edit it.
 */
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
      <DialogContent showCloseButton={false} className={cn(DIALOG_PANEL, 'sm:max-w-105')}>
        {/* The form is a child so it unmounts with the portal: every open starts from the
            event's current values, with no error left over from the last attempt. */}
        <EventForm
          mode={mode}
          event={event}
          onSaved={(saved) => {
            onOpenChange(false);
            // A new event has a PIN and nothing else. Adding channels is the next act, so
            // creating lands on the event rather than back on a list row.
            if (mode === 'create')
              navigate({ to: '/admin/events/$id', params: { id: String(saved.id) } });
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
  // isSubmitting, not just the mutations' isPending: that goes false the moment the
  // request resolves, reopening the button for a second save during the invalidation
  // that follows. isSubmitting covers the whole handler, up to the dialog closing.
  const pending = isSubmitting || create.isPending || update.isPending;

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
      // Deliberately still open: closing here would throw away what the admin typed.
      setFailed(true);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle className={cn('mb-1.5', DIALOG_TITLE)}>
        {creating ? 'New event' : 'Edit event'}
      </DialogTitle>
      <DialogDescription className={cn('mb-5', DIALOG_BODY)}>
        {creating
          ? 'A PIN is generated when you save. The event stays disabled until you switch it on.'
          : 'The PIN and the channels are untouched — only what is below changes.'}
      </DialogDescription>

      <div className="flex flex-col gap-3.5">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="event-name" className={LABEL}>
            Name
          </FieldLabel>
          <Input
            id="event-name"
            autoComplete="off"
            placeholder="Sunday Service"
            aria-invalid={errors.name ? true : undefined}
            className={cn('h-11 rounded-full px-4', TEXT_INPUT)}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="event-description" className={LABEL}>
            Description
          </FieldLabel>
          <Textarea
            id="event-description"
            rows={3}
            placeholder="Morning gathering, main hall."
            aria-invalid={errors.description ? true : undefined}
            className={cn('min-h-19 rounded-md px-4 py-3 leading-normal', TEXT_INPUT)}
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
            <FieldDescription id={switchDescriptionId} className="text-[12.5px]">
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
                className={ENABLED_TRACK}
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
        <DialogClose render={<Button variant="outline" className={DIALOG_ACTION} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending} className={DIALOG_ACTION}>
          {creating ? 'Create event' : 'Save changes'}
        </Button>
      </DialogActions>
    </form>
  );
}

/** Deleting an event takes its channels and its PIN with it, so the copy names all three. */
export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: AdminEventDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('delete', '/admin/events/{id}', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      // Leave the page before touching the cache: invalidating the detail query while the
      // detail route is still mounted refetches an event that no longer exists, and the
      // 404 that comes back flashes the not-found state on the way out.
      onOpenChange(false);
      onDeleted?.();
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

/**
 * Regenerating a PIN destroys nothing, so it takes the neutral tone — but every card and QR
 * code already printed carries the old one, which is the consequence worth spelling out.
 * The control that opens this lives on the event detail screen.
 */
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
      await invalidateAdminEvents(queryClient, event.id);
      onOpenChange(false);
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
