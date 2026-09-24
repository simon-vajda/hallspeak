import type { components } from '@hallspeak/contract/openapi';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { RegeneratePinDialog } from '@/components/admin/regenerate-pin-dialog';
import { EventShareCard } from '@/components/event-share-card';
import { Button } from '@/components/ui/button';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function PinCard({ event }: { event: Pick<AdminEventDetail, 'id' | 'pin' | 'enabled'> }) {
  const [regenerating, setRegenerating] = useState(false);

  return (
    <section className="rounded-lg bg-secondary p-panel text-center">
      <EventShareCard pin={event.pin} />

      <p className="mt-3 text-meta leading-normal text-muted-foreground">
        Regenerating the PIN invalidates every printed card.
      </p>

      <Button
        variant="ghost"
        size="action-sm"
        onClick={() => setRegenerating(true)}
        className="mt-2"
      >
        <RefreshCw />
        Regenerate PIN
      </Button>

      <RegeneratePinDialog event={event} open={regenerating} onOpenChange={setRegenerating} />
    </section>
  );
}
