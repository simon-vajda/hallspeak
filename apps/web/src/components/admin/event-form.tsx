import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { $api } from '@/api/client';
import { DialogActions } from '@/components/confirm-dialog';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
import { invalidateAdminEvents } from '@/lib/admin-queries';
import { type EventFormValues, eventFormSchema } from '@/lib/event-form';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function EventForm({
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
  const nameId = useId();
  const descriptionId = useId();
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
          <FieldLabel htmlFor={nameId} className={MICRO_LABEL}>
            Name
          </FieldLabel>
          <Input
            id={nameId}
            autoComplete="off"
            placeholder="Sunday Service"
            aria-invalid={errors.name ? true : undefined}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor={descriptionId} className={MICRO_LABEL}>
            Description
          </FieldLabel>
          <Textarea
            id={descriptionId}
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
