import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActionButton } from '@/components/action-button';
import { QrCode } from '@/components/qr-code';
import { RefusalBanner } from '@/components/refusal-banner';
import { SheetChrome } from '@/components/sheet-chrome';
import { eventListenerUrl, readEventParams } from '@/links/route';
import { SHARE_COPY, shareQrLabel } from '@/screens/share-copy';

const CONFIRM_MS = 2000;

/**
 * Shares the event, never a channel: a newcomer who scans it picks their own language. The URL
 * is rebuilt from the validated host and PIN, never taken as a parameter.
 */
export default function ShareEventSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ server: string; eventPin: string }>();
  const event = readEventParams(params.server, params.eventPin);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (event === null) {
    return (
      <SheetChrome title={SHARE_COPY.title} onDone={() => router.back()}>
        <RefusalBanner message={SHARE_COPY.refusedBody} />
      </SheetChrome>
    );
  }

  const url = eventListenerUrl(event.host, event.pin);

  const copyLink = () => {
    clearTimeout(timer.current);
    Clipboard.setStringAsync(url).then(
      () => {
        setCopy('copied');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        timer.current = setTimeout(() => setCopy('idle'), CONFIRM_MS);
      },
      () => setCopy('failed'),
    );
  };

  return (
    <SheetChrome title={SHARE_COPY.title} onDone={() => router.back()}>
      <QrCode value={url} label={shareQrLabel(url)} />

      {copy === 'failed' ? <RefusalBanner message={SHARE_COPY.copyFailed} /> : null}

      <ActionButton
        label={copy === 'copied' ? SHARE_COPY.copied : SHARE_COPY.copyAction}
        icon={copy === 'copied' ? 'confirm' : 'copy'}
        compact
        onPress={copyLink}
      />
    </SheetChrome>
  );
}
