import type { components } from '@linguacast/contract/openapi';
import { Download, RefreshCw } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { memo, type RefObject, useRef, useState } from 'react';
import { CopyButton } from '@/components/admin/copy-button';
import { RegeneratePinDialog } from '@/components/admin/event-dialogs';
import { Button } from '@/components/ui/button';
import { formatPin } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

/** 168px box less its 12px quiet-zone padding. */
const QR_SIZE = 144;

/** Big enough to print a poster from, small enough to email. */
const QR_DOWNLOAD_SIZE = 1024;

const ACTION = 'h-9.5 w-full rounded-full px-4.25 font-semibold text-sm';

/**
 * Never displayed; it exists so the download has a raster to read, with the quiet zone baked
 * in for print. Memoised because qrcode.react redraws from an effect with no dependency
 * array, so every re-render of the detail page would repaint 1024px of QR nobody sees.
 */
const DownloadCanvas = memo(function DownloadCanvas({
  url,
  canvasRef,
}: {
  url: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <QRCodeCanvas
      ref={canvasRef}
      value={url}
      size={QR_DOWNLOAD_SIZE}
      marginSize={4}
      bgColor="#ffffff"
      fgColor="#000000"
      className="hidden"
    />
  );
});

/**
 * Everything is derived from `event.pin`, so a regenerate that refetches the event redraws
 * the number and the code together. The design's Print action is not built.
 */
export function PinCard({ event }: { event: Pick<AdminEventDetail, 'id' | 'pin'> }) {
  const [regenerating, setRegenerating] = useState(false);
  const downloadRef = useRef<HTMLCanvasElement>(null);
  const listenerUrl = `${window.location.origin}/events/${event.pin}`;

  // The visible code is an SVG; the download comes off the hidden canvas because a PNG is what
  // drops into a slide or a print shop's upload form without anyone converting anything.
  const download = () => {
    const canvas = downloadRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `linguacast-${event.pin}.png`;
    // Firefox ignores a download click on an anchor that is not in the document.
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <section className="rounded-lg bg-secondary p-5.5 text-center">
      <h2 className="text-label text-muted-foreground uppercase">Listener PIN</h2>
      <p className="mt-1.5 mb-3.5 font-semibold text-[38px] leading-none tracking-[-0.02em]">
        {formatPin(event.pin)}
      </p>

      {/* The plate inverts in dark mode so the code stays dark-on-light in both: scanners are
          unreliable on an inverted QR. */}
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

      <DownloadCanvas url={listenerUrl} canvasRef={downloadRef} />

      <div className="mt-4 flex gap-2">
        <CopyButton
          value={listenerUrl}
          label="Copy link"
          className={ACTION}
          wrapperClassName="flex-1"
        />
        <Button
          variant="outline"
          onClick={download}
          aria-label="Download the QR code as a PNG"
          className="size-9.5 rounded-full px-0"
        >
          <Download />
        </Button>
      </div>

      <p className="mt-3 text-meta leading-normal text-muted-foreground">
        Regenerating the PIN invalidates every printed card.
      </p>

      <Button
        variant="ghost"
        onClick={() => setRegenerating(true)}
        // The card already sits on `secondary`, which is what ghost's hover paints.
        className="mt-2 h-8 gap-1.5 rounded-full px-3 font-semibold text-sm hover:bg-foreground/10 dark:hover:bg-foreground/15"
      >
        <RefreshCw />
        Regenerate PIN
      </Button>

      <RegeneratePinDialog event={event} open={regenerating} onOpenChange={setRegenerating} />
    </section>
  );
}
