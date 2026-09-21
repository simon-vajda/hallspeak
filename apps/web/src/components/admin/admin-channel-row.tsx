import type { components } from '@hallspeak/contract/openapi';
import { Link } from '@tanstack/react-router';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ChannelEnabledSwitch } from '@/components/admin/channel-enabled-switch';
import { ChannelFormDialog } from '@/components/admin/channel-form-dialog';
import { CopyButton } from '@/components/admin/copy-button';
import { DeleteChannelDialog } from '@/components/admin/delete-channel-dialog';
import { RegenerateSpeakerCodeDialog } from '@/components/admin/regenerate-speaker-code-dialog';
import { LiveBadge } from '@/components/live-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ChannelBroadcast, STATUS_UNKNOWN } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];
type AdminChannel = components['schemas']['AdminChannel'];

export function AdminChannelRow({
  event,
  channel,
  broadcast,
}: {
  event: AdminEventDetail;
  channel: AdminChannel;
  broadcast: ChannelBroadcast;
}) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listenerPath = `/events/${event.pin}/${channel.slug}`;
  const speakerUrl = `${window.location.origin}${listenerPath}?speaker_code=${encodeURIComponent(channel.speakerCode)}`;

  return (
    <li className="flex flex-col gap-3.5 border-t border-border px-panel py-4.25 lg:flex-row lg:items-center lg:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <h3 className="truncate text-subtitle">{channel.name}</h3>
          <BroadcastBadge broadcast={broadcast} />
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
        {broadcast.state === 'on-air' && (
          <p className="mt-1 text-meta text-muted-foreground">{broadcast.listeners} listening</p>
        )}
      </div>

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
        <ChannelEnabledSwitch channel={channel} broadcast={broadcast} />
      </fieldset>

      <ChannelFormDialog
        eventId={event.id}
        channel={channel}
        open={editing}
        onOpenChange={setEditing}
      />
      <RegenerateSpeakerCodeDialog
        channel={channel}
        broadcast={broadcast}
        open={regenerating}
        onOpenChange={setRegenerating}
      />
      <DeleteChannelDialog
        channel={channel}
        broadcast={broadcast}
        remaining={event.channels.length - 1}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </li>
  );
}

/**
 * The broadcast axis alone: whether an interpreter is on this channel. Enablement is the
 * switch's to print, and the listener count is its own line — a badge that carried either would
 * have to redraw to say the other changed. The withheld dash is a withholding rather than a
 * relabelling: a dead poll says nothing about the world, so it makes no claim and carries no dot.
 */
function BroadcastBadge({ broadcast }: { broadcast: ChannelBroadcast }) {
  if (broadcast.state === 'withheld') {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-dashed bg-transparent text-muted-foreground uppercase"
      >
        —<span className="sr-only normal-case">{STATUS_UNKNOWN}</span>
      </Badge>
    );
  }

  return (
    <LiveBadge
      live={broadcast.state === 'on-air'}
      label={broadcast.state === 'on-air' ? 'On air' : 'Offline'}
      className="shrink-0"
    />
  );
}
