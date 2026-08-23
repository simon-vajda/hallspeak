import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { ChannelChip } from '@/components/admin/channel-chips';
import { ChannelFormDialog } from '@/components/admin/channel-form-dialog';
import { CopyButton } from '@/components/admin/copy-button';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  eventScope,
  invalidateAdminEvents,
  useAdminLive,
  useOptimisticEventUpdate,
} from '@/lib/admin-queries';
import { channelLiveLabel, plural } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];
type AdminChannel = components['schemas']['AdminChannel'];

function useChannelInvalidation(eventId: number) {
  const queryClient = useQueryClient();
  return () => invalidateAdminEvents(queryClient, eventId);
}

export function ChannelsPanel({ event }: { event: AdminEventDetail }) {
  const live = useAdminLive();
  const [adding, setAdding] = useState(false);

  return (
    <section className="overflow-hidden rounded-lg bg-secondary">
      <div className="flex flex-wrap items-center justify-between gap-3 px-panel py-4.5">
        <h2 className="text-section">Channels</h2>
        <Button onClick={() => setAdding(true)} size="action">
          <Plus />
          Add channel
        </Button>
      </div>

      {event.channels.length === 0 ? (
        <p className="border-t border-border px-panel py-9 text-center text-sm text-muted-foreground">
          No channels yet. A channel is one language a guest can pick, and it carries the speaker
          link an interpreter broadcasts from.
        </p>
      ) : (
        <ul>
          {event.channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              event={event}
              channel={channel}
              live={channelLiveLabel(live.channels.get(channel.id))}
            />
          ))}
        </ul>
      )}

      <ChannelFormDialog eventId={event.id} open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function ChannelRow({
  event,
  channel,
  live,
}: {
  event: AdminEventDetail;
  channel: AdminChannel;
  /** Always rendered, idle included: a channel going live must not change the row's height. */
  live: string;
}) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const listenerPath = `/events/${event.pin}/${channel.slug}`;
  // The listener link plus the code: drop the query and it degrades into a valid listener URL.
  const speakerUrl = `${window.location.origin}${listenerPath}?speaker_code=${encodeURIComponent(channel.speakerCode)}`;

  return (
    <li className="flex flex-col gap-3.5 border-t border-border px-panel py-4.25 lg:flex-row lg:items-center lg:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* The name gives way, not the chip: a truncated name is still readable. */}
          <h3 className="truncate text-subtitle">{channel.name}</h3>
          <ChannelChip enabled={channel.enabled} className="shrink-0">
            {channel.enabled ? 'Enabled' : 'Disabled'}
          </ChannelChip>
        </div>
        <Link
          to="/events/$pin/$slug"
          params={{ pin: event.pin, slug: channel.slug }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open the listener page for ${channel.name} in a new tab`}
          className="mt-1 block truncate font-mono text-muted-foreground text-xs hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {listenerPath}
        </Link>
        <p className="mt-1 text-meta text-muted-foreground">{live}</p>
      </div>

      {/* A fieldset so the cluster carries the channel name: CopyButton takes no label. */}
      <fieldset
        aria-label={`${channel.name} channel`}
        className="flex shrink-0 flex-wrap items-center gap-2"
      >
        <CopyButton
          value={speakerUrl}
          label="Copy speaker link"
          variant="outline"
          size="action-sm"
        />
        <Button
          variant="outline"
          onClick={() => setRegenerating(true)}
          aria-label={`Regenerate the speaker code for ${channel.name}`}
          size="action-sm"
        >
          <RefreshCw />
          Regenerate
        </Button>
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${channel.name}`}
          size="action-sm"
          className="size-11 px-0 lg:size-8.25"
        >
          <Pencil />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeleting(true)}
          aria-label={`Delete ${channel.name}`}
          size="action-sm"
          className="size-11 px-0 text-destructive hover:bg-destructive-muted hover:text-destructive lg:size-8.25"
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
  const cache = useOptimisticEventUpdate(channel.eventId);
  const [failed, setFailed] = useState(false);

  const { mutate } = $api.useMutation('patch', '/admin/channels/{id}', {
    // Scoped to the owning event, not the channel: both caches are keyed by event, so two
    // channels racing each other would settle on an intermediate list.
    scope: { id: eventScope(channel.eventId) },
    onMutate: ({ body }) => {
      setFailed(false);
      // A channel's row and its chip on the events list are the same data, reached through
      // the event that owns it.
      return cache.apply((event) => ({
        ...event,
        channels: event.channels.map((candidate) =>
          candidate.id === channel.id
            ? { ...candidate, enabled: body.enabled ?? candidate.enabled }
            : candidate,
        ),
      }));
    },
    onError: (_error, _variables, previous) => {
      cache.rollback(previous);
      setFailed(true);
    },
    onSettled: cache.settle,
  });

  return (
    <EnabledSwitch
      checked={channel.enabled}
      failed={failed}
      label={`Enable ${channel.name}`}
      onCheckedChange={(enabled) => {
        mutate({ params: { path: { id: channel.id } }, body: { enabled } });
      }}
    />
  );
}

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
  /** Channels the event is left with; the copy calls out deleting the last one. */
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
