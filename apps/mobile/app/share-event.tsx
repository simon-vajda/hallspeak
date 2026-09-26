import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { eventQueryOptions } from '@/api/queries';
import { ActionButton } from '@/components/action-button';
import { FullScreenDialog } from '@/components/full-screen-dialog';
import { QR_QUIET_ZONE, QrCode } from '@/components/qr-code';
import { RefusalBanner } from '@/components/refusal-banner';
import { SheetChrome } from '@/components/sheet-chrome';
import { eventListenerUrl, readEventParams } from '@/links/route';
import { pinDisplay, SHARE_COPY, shareQrLabel } from '@/screens/share-copy';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

const CONFIRM_MS = 2000;
const QR_MAX = 320;
/** The chrome's inset on each side, plus the plate's quiet zone. */
const QR_INSET = 2 * (spacing.overlay + QR_QUIET_ZONE);

/** A full-height sheet on iOS, Material's full-screen dialog on Android. */
const Chrome = Platform.OS === 'android' ? FullScreenDialog : SheetChrome;

/**
 * Shares the event, never a channel: a newcomer who scans it picks their own language. The URL
 * is rebuilt from the validated host and PIN, never taken as a parameter. The name is read
 * from the event screen's cache rather than fetched: the menu offers it only once that
 * screen has read its event.
 */
export default function ShareEventScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ server: string; eventPin: string }>();
  const event = readEventParams(params.server, params.eventPin);
  const { data: cached } = useQuery({
    ...eventQueryOptions(event?.host ?? '', event?.pin ?? ''),
    enabled: false,
  });
  const { width } = useWindowDimensions();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (event === null) {
    return (
      <Chrome title={SHARE_COPY.title} onDone={() => router.back()}>
        <RefusalBanner message={SHARE_COPY.refusedBody} />
      </Chrome>
    );
  }

  const url = eventListenerUrl(event.host, event.pin);
  const pin = pinDisplay(event.pin);

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
    <Chrome title={SHARE_COPY.title} onDone={() => router.back()}>
      <View style={styles.event}>
        {cached ? (
          <Text style={[type.titleLg, styles.centred, { color: colors.foreground }]}>
            {cached.name}
          </Text>
        ) : null}
        <Text
          accessibilityLabel={`${SHARE_COPY.pinLabel} ${pin.spoken}`}
          style={[type.note, styles.centred, { color: colors.mutedForeground }]}
        >
          {SHARE_COPY.pinLabel} {pin.text}
        </Text>
      </View>

      <QrCode value={url} label={shareQrLabel(url)} size={Math.min(QR_MAX, width - QR_INSET)} />

      {copy === 'failed' ? <RefusalBanner message={SHARE_COPY.copyFailed} /> : null}

      <ActionButton
        label={copy === 'copied' ? SHARE_COPY.copied : SHARE_COPY.copyAction}
        icon={copy === 'copied' ? 'confirm' : 'copy'}
        compact
        onPress={copyLink}
      />
    </Chrome>
  );
}

const styles = StyleSheet.create({
  event: { alignItems: 'center', gap: 4 },
  centred: { textAlign: 'center' },
});
