import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/action-button';
import { Icon } from '@/components/icon';
import { RefusalBanner } from '@/components/refusal-banner';
import { ScanReticle } from '@/components/scan-reticle';
import { channelHref, eventHref } from '@/links/route';
import {
  cameraPermission,
  INITIAL_SCAN_STATE,
  offersSettings,
  rearm,
  refusalMessage,
  scan,
  showsTorch,
} from '@/screens/scanner-state';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { DISPLAY_FONT, type } from '@/theme/typography';

/**
 * The only literal colours in the app, and deliberately not role tokens: this screen is a
 * camera field, which is whatever the room looks like rather than a surface of the app. It is
 * black on both platforms in both schemes, and its chrome is white over that.
 */
const OVER_CAMERA = '#FFFFFF';
const CAMERA_FIELD = '#000000';
const OVER_CAMERA_MUTED = 'rgba(255,255,255,0.72)';
const OVER_CAMERA_SCRIM = 'rgba(255,255,255,0.16)';

const IOS = Platform.OS === 'ios';

export default function ScannerScreen() {
  const colors = useColors();
  const router = useRouter();
  const focused = useIsFocused();
  const [status, request] = useCameraPermissions();
  const [state, setState] = useState(INITIAL_SCAN_STATE);
  const [torch, setTorch] = useState(false);

  const permission = cameraPermission(status);

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      const outcome = scan(state, data);

      if (outcome.state === state) {
        return;
      }

      setState(outcome.state);

      if (outcome.haptic) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      const destination = outcome.destination;

      if (destination) {
        router.replace(
          destination.slug
            ? channelHref(destination.host, destination.pin, destination.slug)
            : eventHref(destination.host, destination.pin),
        );
      }
    },
    [router, state],
  );

  return (
    <View style={styles.screen}>
      {/* The camera field is whatever the room looks like: it is dark on both platforms and
          does not follow the app's theme. Unmounting on blur is what releases the session —
          only one preview may be live, and `active` stops it on iOS alone. */}
      {focused && permission === 'granted' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={state.armed ? onScanned : undefined}
        />
      ) : null}

      <ScanReticle />

      <SafeAreaView style={styles.chrome}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={[styles.round, IOS && styles.roundScrim]}
          >
            <Icon name="close" size={IOS ? 19 : 22} color={OVER_CAMERA} strokeWidth={2.4} />
          </Pressable>
          <Text style={[IOS ? styles.iosTitle : styles.androidTitle, styles.overlayText]}>
            Scan to listen
          </Text>
          {IOS ? <View style={styles.round} /> : null}
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.prompt, styles.overlayText]}>Scan the event's QR code</Text>

          {state.refusal ? (
            <RefusalBanner
              message={`${refusalMessage(state.refusal)} Tap to scan again.`}
              onRetry={() => setState(rearm())}
            />
          ) : null}

          {permission === 'granted' ? null : (
            <>
              <Text style={[type.note, styles.centred, styles.overlayMuted]}>
                {offersSettings(permission)
                  ? 'LinguaCast cannot use the camera. You can turn it on in Settings.'
                  : 'LinguaCast needs the camera to read the code at your venue.'}
              </Text>
              <ActionButton
                label={offersSettings(permission) ? 'Open Settings' : 'Allow the camera'}
                icon="scan"
                onPress={() =>
                  offersSettings(permission) ? void Linking.openSettings() : void request()
                }
              />
            </>
          )}

          {/* Link entry is a peer of the camera in every permission state, not a fallback
              that appears once the camera has been refused. */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/link')}
              style={[
                styles.linkAction,
                IOS
                  ? styles.roundScrim
                  : { backgroundColor: colors.primary, borderRadius: radius.lg },
              ]}
            >
              <Icon
                name="link"
                size={IOS ? 18 : 20}
                color={IOS ? OVER_CAMERA : colors.primaryForeground}
              />
              <Text style={[type.section, { color: IOS ? OVER_CAMERA : colors.primaryForeground }]}>
                Enter the link instead
              </Text>
            </Pressable>

            {showsTorch(permission) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
                accessibilityState={{ selected: torch }}
                onPress={() => setTorch((on) => !on)}
                style={[styles.torch, IOS ? styles.roundScrim : styles.torchSquircle]}
              >
                <Icon
                  name={torch ? 'torchOff' : 'torchOn'}
                  size={IOS ? 20 : 22}
                  color={OVER_CAMERA}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAMERA_FIELD },
  chrome: { flex: 1, justifyContent: 'space-between' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS ? 0 : 6,
    paddingHorizontal: IOS ? 18 : 8,
    paddingTop: 4,
  },
  round: {
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundScrim: { backgroundColor: OVER_CAMERA_SCRIM },
  iosTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  androidTitle: { flex: 1, fontSize: 22, fontWeight: '400' },
  bottom: { gap: 14, paddingHorizontal: IOS ? 26 : 24, paddingBottom: 26 },
  prompt: {
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    lineHeight: 27.5,
    letterSpacing: -0.22,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkAction: {
    flex: 1,
    minWidth: 0,
    minHeight: IOS ? 50 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOS ? 9 : 10,
    borderRadius: radius.full,
    paddingHorizontal: 16,
  },
  torch: {
    width: IOS ? 50 : 56,
    height: IOS ? 50 : 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchSquircle: { borderRadius: 18, backgroundColor: OVER_CAMERA_SCRIM },
  centred: { textAlign: 'center' },
  overlayText: { color: OVER_CAMERA },
  overlayMuted: { color: OVER_CAMERA_MUTED },
});
