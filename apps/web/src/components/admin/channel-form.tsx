import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
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
import { invalidateAdminEvents } from '@/lib/admin-queries';
import { type ChannelFormValues, channelFormSchema, slugify } from '@/lib/channel-form';

type AdminChannel = components['schemas']['AdminChannel'];
type Problem = components['schemas']['Problem'];

function isSlugTaken(error: unknown): error is Problem {
  return (
    typeof error === 'object' && error !== null && (error as Partial<Problem>).code === 'slug_taken'
  );
}

export function ChannelForm({
  eventId,
  channel,
  onSaved,
}: {
  eventId: number;
  channel?: AdminChannel;
  onSaved: () => void;
}) {
  const creating = !channel;
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const nameId = useId();
  const slugId = useId();
  const slugNoteId = useId();
  const switchLabelId = useId();
  const switchDescriptionId = useId();
  const slugEdited = useRef(false);
  const {
    register,
    control,
    setValue,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: channel?.name ?? '',
      slug: channel?.slug ?? '',
      enabled: channel?.enabled ?? false,
    },
    mode: 'onSubmit',
  });
  const nameField = register('name');
  const slugField = register('slug');
  const create = $api.useMutation('post', '/admin/events/{id}/channels');
  const update = $api.useMutation('patch', '/admin/channels/{id}');

  const onSubmit = handleSubmit(async (values) => {
    setFailed(false);
    try {
      if (channel) {
        await update.mutateAsync({
          params: { path: { id: channel.id } },
          body: { name: values.name, enabled: values.enabled },
        });
      } else {
        await create.mutateAsync({
          params: { path: { id: eventId } },
          body: { slug: values.slug, name: values.name, enabled: values.enabled },
        });
      }
      await invalidateAdminEvents(queryClient, eventId);
      onSaved();
    } catch (error) {
      if (isSlugTaken(error)) {
        setError('slug', { message: 'That slug is already used on this event.' });
        return;
      }
      setFailed(true);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle className="mb-1.5">{creating ? 'New channel' : 'Edit channel'}</DialogTitle>
      <DialogDescription className="mb-5">
        {creating
          ? 'A speaker code is generated when you save. The channel stays disabled until you switch it on.'
          : 'The speaker code and the listener link are untouched — only what is below changes.'}
      </DialogDescription>

      <div className="flex flex-col gap-3.5">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={nameId} className={MICRO_LABEL}>
            Name
          </FieldLabel>
          <Input
            id={nameId}
            autoComplete="off"
            placeholder="Español"
            aria-invalid={errors.name ? true : undefined}
            {...nameField}
            onChange={(event) => {
              nameField.onChange(event);
              if (creating && !slugEdited.current) {
                setValue('slug', slugify(event.target.value));
              }
            }}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor={slugId} className={MICRO_LABEL}>
            Slug
          </FieldLabel>
          {creating ? (
            <Input
              id={slugId}
              autoComplete="off"
              spellCheck={false}
              placeholder="espanol"
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby={slugNoteId}
              className="font-mono"
              {...slugField}
              onChange={(event) => {
                slugEdited.current = true;
                slugField.onChange(event);
              }}
            />
          ) : (
            <Input
              id={slugId}
              readOnly
              value={channel.slug}
              aria-describedby={slugNoteId}
              className="font-mono text-muted-foreground"
            />
          )}
          <FieldDescription id={slugNoteId} className="text-meta">
            {creating
              ? 'This becomes part of the listener link and is permanent once the channel exists.'
              : 'Fixed once the channel exists — changing it would break every printed QR code.'}
          </FieldDescription>
          <FieldError errors={[errors.slug]} />
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
                ? 'Guests can pick it as soon as it exists'
                : 'Guests can pick it while this is on'}
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
            ? 'Could not create the channel. Nothing was saved — try again.'
            : 'Could not save your changes. The channel is as it was — try again.'}
        </p>
      )}

      <DialogActions>
        <DialogClose render={<Button variant="outline" size="action" />}>Cancel</DialogClose>
        <Button type="submit" size="action" disabled={isSubmitting}>
          {creating ? 'Add channel' : 'Save changes'}
        </Button>
      </DialogActions>
    </form>
  );
}
