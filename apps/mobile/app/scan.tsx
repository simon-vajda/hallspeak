import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/action-button';
import { Icon } from '@/components/icon';
import { RefusalBanner } from '@/components/refusal-banner';
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
const OVER_CAMERA_SCRIM = 'rgba(255,255,255,0.18)';

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

      <SafeAreaView style={styles.chrome}>
        <View style={styles.topRow}>
          <RoundButton icon="close" label="Close" onPress={() => router.back()} />
          {showsTorch(permission) ? (
            <RoundButton
              icon={torch ? 'torchOff' : 'torchOn'}
              label={torch ? 'Turn the torch off' : 'Turn the torch on'}
              onPress={() => setTorch((on) => !on)}
            />
          ) : null}
        </View>

        {/* Four corners rather than a closed frame, and nothing animates: the product's only
            two animations are tied to audio, and a sweeping laser would claim work that is
            not happening. */}
        <View style={styles.reticle}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View
              key={corner}
              style={[styles.corner, CORNERS[corner], { borderColor: colors.primary }]}
            />
          ))}
        </View>

        <View style={styles.bottom}>
          <Text style={[type.title, styles.centred, styles.overlayText]}>Scan to listen</Text>
          <Text style={[type.note, styles.centred, styles.overlayMuted]}>
            {permission === 'granted'
              ? "Point the camera at the event's QR code"
              : offersSettings(permission)
                ? 'LinguaCast cannot use the camera. You can turn it on in Settings.'
                : 'LinguaCast needs the camera to read the code at your venue.'}
          </Text>

          {state.refusal ? (
            <RefusalBanner
              message={`${refusalMessage(state.refusal)} Tap to scan again.`}
              onRetry={() => setState(rearm())}
            />
          ) : null}

          {permission === 'undetermined' ? (
            <ActionButton label="Allow the camera" icon="scan" onPress={() => void request()} />
          ) : null}
          {offersSettings(permission) ? (
            <ActionButton
              label="Open Settings"
              icon="scan"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}

          {/* A peer of the camera, not an item in a menu. */}
          <ActionButton
            label="Enter the link instead"
            icon="link"
            variant="outlined"
            onPress={() => router.push('/link')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'close' | 'torchOn' | 'torchOff';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.round}
    >
      <Icon name={icon} size={20} color={OVER_CAMERA} />
    </Pressable>
  );
}

const CORNERS = {
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.md },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.md },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.md,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.md,
  },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAMERA_FIELD },
  chrome: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.gutter },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  round: {
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OVER_CAMERA_SCRIM,
  },
  reticle: { alignSelf: 'center', width: 232, height: 232 },
  corner: { position: 'absolute', width: 44, height: 44 },
  bottom: { gap: 10, paddingBottom: 20 },
  centred: { textAlign: 'center' },
  overlayText: { color: OVER_CAMERA },
  overlayMuted: { color: OVER_CAMERA_MUTED, paddingBottom: 4 },
});
