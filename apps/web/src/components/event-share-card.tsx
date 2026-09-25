import { drawQr, type QrDrawing } from '@hallspeak/client-core/qr';
import { Download } from 'lucide-react';
import { useMemo } from 'react';
import logoMark from '@/assets/logo-mark.svg';
import { CopyButton } from '@/components/copy-button';
import { MICRO_LABEL } from '@/components/micro-label';
import { Pin } from '@/components/pin';
import { Button } from '@/components/ui/button';
import { listenerEventUrl } from '@/lib/listener-url';

/** 168px box less its 12px quiet-zone padding. */
const QR_SIZE = 144;

/** Big enough to print a poster from, small enough to email. */
const QR_DOWNLOAD_SIZE = 1024;

/** The quiet zone the QR specification asks for, in modules, baked into the PNG for print. */
const QR_DOWNLOAD_MARGIN = 4;

/**
 * A PNG is what drops into a slide or a print shop's upload form without anyone converting
 * anything. It is drawn from the same path as the visible code, black on white.
 */
async function downloadQr({ size, path, logo }: QrDrawing, fileName: string) {
  const mark = new Image();
  mark.src = logoMark;
  await mark.decode();

  const canvas = document.createElement('canvas');
  canvas.width = QR_DOWNLOAD_SIZE;
  canvas.height = QR_DOWNLOAD_SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, QR_DOWNLOAD_SIZE, QR_DOWNLOAD_SIZE);
  const scale = QR_DOWNLOAD_SIZE / (size + 2 * QR_DOWNLOAD_MARGIN);
  context.scale(scale, scale);
  context.translate(QR_DOWNLOAD_MARGIN, QR_DOWNLOAD_MARGIN);
  context.fillStyle = '#000000';
  context.fill(new Path2D(path), 'evenodd');
  if (logo) {
    const fit = logo.size / Math.max(mark.naturalWidth, mark.naturalHeight);
    const width = mark.naturalWidth * fit;
    const height = mark.naturalHeight * fit;
    context.drawImage(
      mark,
      logo.offset + (logo.size - width) / 2,
      logo.offset + (logo.size - height) / 2,
      width,
      height,
    );
  }

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = fileName;
  // Firefox ignores a download click on an anchor that is not in the document.
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Everything is derived from `pin`, so a regenerate that refetches the event redraws the
 * number and the code together. There is no Print action: the PNG is what a print shop or a
 * slide takes, and a browser print dialog adds nothing to it.
 */
export function EventShareCard({
  pin,
  eventName,
  labelAs: Label = 'h2',
}: {
  pin: string;
  /** Leads the card in place of the PIN, which drops to a muted line beneath it. */
  eventName?: string;
  labelAs?: 'h2' | 'h3';
}) {
  const listenerUrl = listenerEventUrl(window.location.origin, pin);
  const qr = useMemo(() => drawQr(listenerUrl, { logo: true }), [listenerUrl]);

  return (
    <div className="text-center">
      {eventName ? (
        <>
          <Label className="text-title break-words">{eventName}</Label>
          <p className="mt-1 mb-4 text-note text-muted-foreground">
            PIN <Pin pin={pin} />
          </p>
        </>
      ) : (
        <>
          <Label className={MICRO_LABEL}>Listener PIN</Label>
          <p className="mt-1.5 mb-3.5 text-stat-lg">
            <Pin pin={pin} />
          </p>
        </>
      )}

      {/* The plate inverts in dark mode so the code stays dark-on-light in both: scanners are
          unreliable on an inverted QR. */}
      <div className="mx-auto flex size-42 items-center justify-center rounded-md bg-background p-3 text-foreground dark:bg-foreground dark:text-background">
        <svg role="img" width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${qr.size} ${qr.size}`}>
          <title>{`QR code linking to ${listenerUrl}`}</title>
          <path d={qr.path} fillRule="evenodd" fill="currentColor" />
          {qr.logo ? (
            <image
              href={logoMark}
              x={qr.logo.offset}
              y={qr.logo.offset}
              width={qr.logo.size}
              height={qr.logo.size}
            />
          ) : null}
        </svg>
      </div>

      <div className="mt-4 flex gap-2">
        <CopyButton
          value={listenerUrl}
          label="Copy link"
          className="w-full"
          wrapperClassName="flex-1"
        />
        <Button
          variant="outline"
          onClick={() => downloadQr(qr, `hallspeak-${pin}.png`)}
          aria-label="Download the QR code as a PNG"
          size="icon-action"
        >
          <Download />
        </Button>
      </div>
    </div>
  );
}
