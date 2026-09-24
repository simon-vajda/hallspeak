import { Download } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { memo, type RefObject, useRef } from 'react';
import { CopyButton } from '@/components/copy-button';
import { MICRO_LABEL } from '@/components/micro-label';
import { Pin } from '@/components/pin';
import { Button } from '@/components/ui/button';
import { listenerEventUrl } from '@/lib/listener-url';

/** 168px box less its 12px quiet-zone padding. */
const QR_SIZE = 144;

/** Big enough to print a poster from, small enough to email. */
const QR_DOWNLOAD_SIZE = 1024;

/**
 * Never displayed; it exists so the download has a raster to read, with the quiet zone baked
 * in for print. Memoised because qrcode.react redraws from an effect with no dependency
 * array, so every re-render of the host page would repaint 1024px of QR nobody sees.
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
 * Everything is derived from `pin`, so a regenerate that refetches the event redraws the
 * number and the code together. There is no Print action: the PNG is what a print shop or a
 * slide takes, and a browser print dialog adds nothing to it.
 */
export function EventShareCard({
  pin,
  labelAs: Label = 'h2',
}: {
  pin: string;
  labelAs?: 'h2' | 'h3';
}) {
  const downloadRef = useRef<HTMLCanvasElement>(null);
  const listenerUrl = listenerEventUrl(window.location.origin, pin);

  // The visible code is an SVG; the download comes off the hidden canvas because a PNG is what
  // drops into a slide or a print shop's upload form without anyone converting anything.
  const download = () => {
    const canvas = downloadRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `hallspeak-${pin}.png`;
    // Firefox ignores a download click on an anchor that is not in the document.
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <div className="text-center">
      <Label className={MICRO_LABEL}>Listener PIN</Label>
      <p className="mt-1.5 mb-3.5 text-stat-lg">
        <Pin pin={pin} />
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
          className="w-full"
          wrapperClassName="flex-1"
        />
        <Button
          variant="outline"
          onClick={download}
          aria-label="Download the QR code as a PNG"
          size="icon-action"
        >
          <Download />
        </Button>
      </div>
    </div>
  );
}
