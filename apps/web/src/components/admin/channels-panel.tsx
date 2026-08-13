import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { ChannelChip } from '@/components/admin/channel-chips';
import { ChannelFormDialog } from '@/components/admin/channel-form-dialog';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CopyButton } from '@/components/admin/copy-button';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { Button } from '@/components/ui/button';
import { eventDetailKey, eventsListKey, invalidateAdminEvents } from '@/lib/admin-queries';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];
type AdminChannel = components['schemas']['AdminChannel'];

/**
 * A row control: 33px as drawn, but 44px below `lg`, where the controls sit under the row
 * and have to clear the minimum hit target.
 */
const ROW_ACTION =
  "h-11 gap-1.5 rounded-full px-3.25 text-xs font-semibold [&_svg:not([class*='size-'])]:size-3.5 lg:h-8.25";

function useChannelInvalidation(eventId: number) {
  const queryClient = useQueryClient();
  return () => invalidateAdminEvents(queryClient, eventId);
}

export function ChannelsPanel({ event }: { event: AdminEventDetail }) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="overflow-hidden rounded-lg bg-secondary">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4.5">
        <h2 className="text-section">Channels</h2>
        <Button
          onClick={() => setAdding(true)}
          className="h-9.5 gap-2 rounded-full px-4.25 font-semibold text-sm"
        >
          <Plus />
          Add channel
        </Button>
      </div>

      {event.channels.length === 0 ? (
        <p className="border-t border-border px-5.5 py-9 text-center text-sm text-muted-foreground">
          No channels yet. A channel is one language a guest can pick, and it carries the speaker
          link an interpreter broadcasts from.
        </p>
      ) : (
        <ul>
          {event.channels.map((channel) => (
            <ChannelRow key={channel.id} event={event} channel={channel} />
          ))}
        </ul>
      )}

      <ChannelFormDialog eventId={event.id} open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function ChannelRow({ event, channel }: { event: AdminEventDetail; channel: AdminChannel }) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const listenerPath = `/events/${event.pin}/${channel.slug}`;
  // The speaker link is the listener link plus the code, exactly as the channel route reads
  // it — drop the query and it degrades into a valid listener URL.
  const speakerUrl = `${window.location.origin}${listenerPath}?speaker_code=${encodeURIComponent(channel.speakerCode)}`;

  return (
    <li className="flex flex-col gap-3.5 border-t border-border px-5.5 py-4.25 lg:flex-row lg:items-center lg:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold text-[18px] tracking-[-0.025em]">{channel.name}</h3>
          <ChannelChip enabled={channel.enabled}>
            {channel.enabled ? 'Enabled' : 'Disabled'}
          </ChannelChip>
        </div>
        <p className="mt-1 truncate font-mono text-muted-foreground text-xs">{listenerPath}</p>
      </div>

      {/* A fieldset, so the cluster carries the channel's name into the accessibility tree:
          CopyButton names itself from its visible label and takes no label of its own. */}
      <fieldset
        aria-label={`${channel.name} channel`}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        <CopyButton
          value={speakerUrl}
          label="Copy speaker link"
          variant="outline"
          className={cn(ROW_ACTION, 'w-full lg:w-auto')}
          wrapperClassName="flex-1 basis-full lg:flex-none lg:basis-auto"
        />
        <Button
          variant="outline"
          onClick={() => setRegenerating(true)}
          aria-label={`Regenerate the speaker code for ${channel.name}`}
          className={ROW_ACTION}
        >
          <RefreshCw />
          Regenerate
        </Button>
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${channel.name}`}
          className={cn(ROW_ACTION, 'size-11 px-0 lg:size-8.25')}
        >
          <Pencil />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeleting(true)}
          aria-label={`Delete ${channel.name}`}
          className={cn(
            ROW_ACTION,
            'size-11 px-0 text-destructive hover:bg-destructive-muted hover:text-destructive lg:size-8.25',
          )}
        >
          <Trash2 />
        </Button>
        <ChannelEnabledSwitch channel={channel} />
      </fieldset>

      <ChannelFormDialog
        eventId={event.id}
        channel={channel}
        open={editing}
        onOpenChange={setEditing}
      />
      <RegenerateSpeakerCodeDialog
        channel={channel}
        open={regenerating}
        onOpenChange={setRegenerating}
      />
      <DeleteChannelDialog
        channel={channel}
        remaining={event.channels.length - 1}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </li>
  );
}

function ChannelEnabledSwitch({ channel }: { channel: AdminChannel }) {
  const queryClient = useQueryClient();
  const invalidate = useChannelInvalidation(channel.eventId);
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('patch', '/admin/channels/{id}', {
    onMutate: async (variables) => {
      setFailed(false);
      const detail = eventDetailKey(channel.eventId);
      const list = eventsListKey();
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detail }),
        queryClient.cancelQueries({ queryKey: list }),
      ]);
      const previous = {
        detail: queryClient.getQueryData<AdminEventDetail>(detail),
        list: queryClient.getQueryData<AdminEventDetail[]>(list),
      };

      const enabled = variables.body.enabled;
      const apply = (event: AdminEventDetail) => ({
        ...event,
        channels: event.channels.map((candidate) =>
          candidate.id === channel.id
            ? { ...candidate, enabled: enabled ?? candidate.enabled }
            : candidate,
        ),
      });
      queryClient.setQueryData<AdminEventDetail>(detail, (current) => current && apply(current));
      queryClient.setQueryData<AdminEventDetail[]>(list, (events) =>
        events?.map((event) => (event.id === channel.eventId ? apply(event) : event)),
      );

      return previous;
    },
    onError: (_error, _variables, context) => {
      if (context?.detail)
        queryClient.setQueryData(eventDetailKey(channel.eventId), context.detail);
      if (context?.list) queryClient.setQueryData(eventsListKey(), context.list);
      setFailed(true);
    },
    onSettled: invalidate,
  });

  return (
    <EnabledSwitch
      checked={channel.enabled}
      disabled={isPending}
      failed={failed}
      label={`Enable ${channel.name}`}
      onCheckedChange={(enabled) => {
        mutate({ params: { path: { id: channel.id } }, body: { enabled } });
      }}
    />
  );
}

/**
 * A new speaker code is the only answer to a leaked one, so the copy leads with what it
 * costs: whoever holds the old link is cut off the moment this runs.
 */
function RegenerateSpeakerCodeDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: AdminChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useChannelInvalidation(channel.eventId);
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation(
    'post',
    '/admin/channels/{id}/regenerate-speaker-code',
    {
      onMutate: () => setFailed(false),
      onSuccess: async () => {
        await invalidate();
        onOpenChange(false);
      },
      onError: () => setFailed(true),
    },
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<RefreshCw className="size-5" />}
      title={`New speaker code for ${channel.name}?`}
      confirmLabel="Generate new code"
      cancelLabel="Keep this code"
      pending={isPending}
      error={
        failed ? 'Could not generate a new code. The old one still works — try again.' : undefined
      }
      onConfirm={() => mutate({ params: { path: { id: channel.id } } })}
    >
      <p>
        The speaker link you have already shared stops working immediately. Send the new one to
        whoever interprets this channel.
      </p>
      <p>Listeners are unaffected — their link does not carry the code.</p>
    </ConfirmDialog>
  );
}

function DeleteChannelDialog({
  channel,
  remaining,
  open,
  onOpenChange,
}: {
  channel: AdminChannel;
  /** Channels the event is left with — deleting the last one is worth saying out loud. */
  remaining: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useChannelInvalidation(channel.eventId);
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('delete', '/admin/channels/{id}', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      await invalidate();
      onOpenChange(false);
    },
    onError: () => setFailed(true),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="size-5" />}
      title={`Delete ${channel.name}?`}
      confirmLabel="Delete"
      cancelLabel="Keep channel"
      pending={isPending}
      error={failed ? 'Could not delete the channel. Nothing was removed — try again.' : undefined}
      onConfirm={() => mutate({ params: { path: { id: channel.id } } })}
    >
      <p>
        <span className="font-mono">/{channel.slug}</span> stops resolving immediately and anyone
        listening to it will be disconnected. The event keeps its PIN
        {remaining > 0
          ? ` and its other ${plural(remaining, 'channel')}`
          : ', but it is left with no channels at all'}
        .
      </p>
      <p>This cannot be undone. A channel added again later gets a different speaker code.</p>
    </ConfirmDialog>
  );
}
