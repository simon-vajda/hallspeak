import type { components } from '@hallspeak/contract/openapi';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AdminChannelRow } from '@/components/admin/admin-channel-row';
import { ChannelFormDialog } from '@/components/admin/channel-form-dialog';
import { Button } from '@/components/ui/button';
import { useAdminLive } from '@/lib/admin-queries';
import { channelBroadcast } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

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
            <AdminChannelRow
              key={channel.id}
              event={event}
              channel={channel}
              broadcast={channelBroadcast(live.channels.get(channel.id), live.known)}
            />
          ))}
        </ul>
      )}

      <ChannelFormDialog eventId={event.id} open={adding} onOpenChange={setAdding} />
    </section>
  );
}
