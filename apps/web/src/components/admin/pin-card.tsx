import type { components } from '@linguacast/contract/openapi';
import { RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { CopyButton } from '@/components/admin/copy-button';
import { RegeneratePinDialog } from '@/components/admin/event-dialogs';
import { Button } from '@/components/ui/button';
import { formatPin } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

/** 168px box less its 12px quiet-zone padding. */
const QR_SIZE = 144;

/**
 * The PIN, its QR code and the share actions. Everything here is derived from `event.pin`,
 * so a regenerate that refetches the event redraws the number and the code together.
 *
 * The design also draws a Print action; printing is out of scope for now and a button that
 * does nothing is worse than one that isn't there.
 */
export function PinCard({ event }: { event: Pick<AdminEventDetail, 'id' | 'pin'> }) {
  const [regenerating, setRegenerating] = useState(false);
  const listenerUrl = `${window.location.origin}/events/${event.pin}`;

  return (
    <section className="rounded-lg bg-secondary p-5.5 text-center">
      <h2 className="text-label text-muted-foreground uppercase">Listener PIN</h2>
      <p className="mt-1.5 mb-3.5 font-semibold text-[38px] leading-none tracking-[-0.02em]">
        {formatPin(event.pin)}
      </p>

      {/* The plate inverts in dark mode so the code stays dark-on-light in both: scanners
          are unreliable on an inverted QR, and this is the one thing here that has to work
          through a camera. `currentColor` then keeps the modules on the token. */}
      <div className="mx-auto flex size-42 items-center justify-center rounded-md bg-background p-3 text-foreground dark:bg-foreground dark:text-background">
        <QRCodeSVG
          role="img"
          title={`QR code linking to ${listenerUrl}`}
          value={listenerUrl}
          size={QR_SIZE}
          marginSize={0}
          bgColor="transparent"
          fgColor="currentColor"
        />
      </div>

      <CopyButton
        value={listenerUrl}
        label="Copy link"
        className="h-9.5 w-full rounded-full px-4.25 font-semibold text-sm"
        wrapperClassName="mt-4"
      />

      <p className="mt-3 text-meta leading-normal text-muted-foreground">
        Regenerating the PIN invalidates every printed card.
      </p>

      <Button
        variant="ghost"
        onClick={() => setRegenerating(true)}
        className="mt-2 h-8 gap-1.5 rounded-full px-3 font-semibold text-sm"
      >
        <RefreshCw />
        Regenerate PIN
      </Button>

      <RegeneratePinDialog event={event} open={regenerating} onOpenChange={setRegenerating} />
    </section>
  );
}
