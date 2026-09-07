import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassSurface } from '@/components/glass-surface';
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
import { type } from '@/theme/typography';

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
const TORCH_SIZE = 56;

export default function ScannerScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [status, request] = useCameraPermissions();
  const [state, setState] = useState(INITIAL_SCAN_STATE);
  const [torch, setTorch] = useState(false);
  // A GlassView sizes to its content and ignores flex, so the pill beside the torch is given
  // the width the row measured rather than asked to share it.
  const [rowWidth, setRowWidth] = useState<number | null>(null);

  const permission = cameraPermission(status);
  const torchWidth = showsTorch(permission) ? TORCH_SIZE : 0;

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
          <ChromeButton label="Close" icon="close" onPress={() => router.back()} />
          <Text style={styles.screenTitle}>Scan to listen</Text>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.prompt}>Scan the event's QR code</Text>

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
              <WideAction
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
          <View
            style={styles.actionRow}
            onLayout={({ nativeEvent }) => setRowWidth(nativeEvent.layout.width)}
          >
            <WideAction
              label="Enter the link instead"
              icon="link"
              width={rowWidth === null ? undefined : rowWidth - (torchWidth ? torchWidth + 12 : 0)}
              onPress={() => router.push('/link')}
            />

            {showsTorch(permission) ? (
              <ChromeButton
                label={torch ? 'Turn the torch off' : 'Turn the torch on'}
                icon={torch ? 'torchOff' : 'torchOn'}
                selected={torch}
                large
                onPress={() => setTorch((on) => !on)}
              />
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Over a live camera, iOS gets real liquid glass and Android a translucent scrim — the same
 * split the design draws, and the one place glass has something worth refracting.
 */
function ChromeButton({
  label,
  icon,
  onPress,
  selected = false,
  large = false,
}: {
  label: string;
  icon: 'close' | 'torchOn' | 'torchOff';
  onPress: () => void;
  selected?: boolean;
  large?: boolean;
}) {
  const size = large ? TORCH_SIZE : spacing.touch;
  const shape = {
    width: size,
    height: size,
    borderRadius: large && !IOS ? 18 : size / 2,
    // Android's translucent fallback gets a jagged-looking hairline over the camera feed.
    borderWidth: IOS ? undefined : 0,
  };

  return (
    <GlassSurface interactive fallbackColor={OVER_CAMERA_SCRIM} style={shape}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.centreBox, shape]}
      >
        <Icon name={icon} size={large ? 22 : 20} color={OVER_CAMERA} strokeWidth={2.2} />
      </Pressable>
    </GlassSurface>
  );
}

function WideAction({
  label,
  icon,
  onPress,
  width,
}: {
  label: string;
  icon: 'link' | 'scan';
  onPress: () => void;
  width?: number;
}) {
  const colors = useColors();

  // Android's is Material's filled button; iOS's is a glass pill over the camera.
  if (!IOS) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[
          styles.wide,
          width === undefined ? styles.stretch : { width },
          { backgroundColor: colors.primary, borderRadius: radius.lg },
        ]}
      >
        <Icon name={icon} size={20} color={colors.primaryForeground} />
        <Text style={[type.section, { color: colors.primaryForeground }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <GlassSurface
      interactive
      fallbackColor={OVER_CAMERA_SCRIM}
      style={width === undefined ? styles.widePill : { ...styles.widePill, width }}
    >
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.wide}>
        <Icon name={icon} size={18} color={OVER_CAMERA} />
        <Text style={[type.section, styles.overlayText]}>{label}</Text>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAMERA_FIELD },
  chrome: { flex: 1, justifyContent: 'space-between' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  screenTitle: { ...type.prompt, flex: 1, color: OVER_CAMERA },
  centreBox: { alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: 14, paddingHorizontal: 24, paddingBottom: 26 },
  prompt: { ...type.prompt, textAlign: 'center', color: OVER_CAMERA },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stretch: { alignSelf: 'stretch' },
  widePill: { borderRadius: radius.full, alignSelf: 'stretch' },
  wide: {
    minHeight: spacing.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  centred: { textAlign: 'center' },
  overlayText: { color: OVER_CAMERA },
  overlayMuted: { color: OVER_CAMERA_MUTED },
});
