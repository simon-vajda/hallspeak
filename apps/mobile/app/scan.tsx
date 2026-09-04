import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { LinkEntrySheet } from '@/components/link-entry-sheet';
import { Reticle } from '@/components/reticle';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/theme/tokens';
import { addVenueReducer, addVenueView, INITIAL_ADD_VENUE_STATE } from '@/venues/add-venue-state';
import { openEvent } from '@/venues/client';
import type { Venue } from '@/venues/types';

/**
 * The camera field is the room, not the app: it stays dark whichever theme the phone is in,
 * so its surfaces are fixed values and its type takes the dark palette's roles directly.
 */
const FIELD = {
  background: colors.dark.background,
  foreground: colors.dark.foreground,
  glass: 'rgba(255, 255, 255, 0.18)',
} as const;

const IOS = Platform.OS === 'ios';

const TOP_TITLE = 'Scan to listen';
const PROMPT = "Scan the event's QR code";
const LINK_ACTION = 'Enter the link instead';
const OPENING = 'Opening…';

export default function Scan() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, dispatch] = useReducer(addVenueReducer, INITIAL_ADD_VENUE_STATE);
  const [torch, setTorch] = useState(false);
  const view = addVenueView(state);

  // Asked for here rather than at launch: a prompt before the listener has asked for anything
  // is the one they refuse.
  useEffect(() => {
    if (permission !== null && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (permission === null) {
      return;
    }
    dispatch({
      kind: 'permission',
      permission: permission.granted
        ? 'granted'
        : permission.canAskAgain && permission.status === 'undetermined'
          ? 'undetermined'
          : 'denied',
    });
  }, [permission]);

  const pending = state.pending;
  useEffect(() => {
    if (pending === null) {
      return;
    }
    let cancelled = false;
    void openEvent(pending.host, pending.pin).then((lookup) => {
      if (!cancelled) {
        dispatch({ kind: 'resolved', lookup });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  const opened = view.openEvent;
  useEffect(() => {
    if (opened !== null) {
      openVenue(opened);
    }
  }, [opened]);

  return (
    <View style={[styles.screen, { backgroundColor: FIELD.background }]}>
      {view.camera === 'active' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => dispatch({ kind: 'submit', input: data })}
        />
      ) : null}
      <Reticle cornerRadius={IOS ? radius.xl : radius.lg} />

      <View style={[styles.chrome, { paddingTop: insets.top + spacing.step * (IOS ? 3 : 1) }]}>
        <View style={IOS ? styles.topBarIos : styles.topBarAndroid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={[styles.round, IOS ? { backgroundColor: FIELD.glass } : null]}
          >
            <Icon name="x" size={19} color="primary" />
          </Pressable>
          <Text
            variant={IOS ? 'section' : 'title'}
            style={[IOS ? styles.titleIos : styles.titleAndroid, { color: FIELD.foreground }]}
          >
            {TOP_TITLE}
          </Text>
          {IOS ? <View style={styles.round} /> : null}
        </View>

        <View style={styles.spacer} />

        <View style={[styles.foot, { paddingBottom: insets.bottom + spacing.panel }]}>
          <Text variant="title" style={[styles.prompt, { color: FIELD.foreground }]}>
            {PROMPT}
          </Text>
          {view.cameraNotice === null ? null : (
            <Text variant="note" style={[styles.notice, { color: FIELD.foreground }]}>
              {view.cameraNotice}
            </Text>
          )}
          {view.busy ? (
            <Text variant="note" style={[styles.notice, { color: FIELD.foreground }]}>
              {OPENING}
            </Text>
          ) : null}
          {view.error === null ? null : (
            <Text variant="note" color="destructive" style={styles.notice}>
              {view.error}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!view.linkEntryEnabled}
              onPress={() => dispatch({ kind: 'open-link-entry' })}
              style={[
                styles.linkAction,
                { backgroundColor: IOS ? FIELD.glass : colors.light.primary },
                IOS ? styles.pill : styles.squircle,
              ]}
            >
              <Icon name="link" size={18} color={IOS ? 'primary' : 'primaryForeground'} />
              <Text
                variant="section"
                style={
                  IOS ? { color: FIELD.foreground } : { color: colors.light.primaryForeground }
                }
              >
                {LINK_ACTION}
              </Text>
            </Pressable>

            {view.camera === 'active' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'}
                onPress={() => setTorch((on) => !on)}
                style={[
                  IOS ? styles.torchIos : styles.torchAndroid,
                  { backgroundColor: FIELD.glass },
                  IOS ? styles.pill : styles.squircle,
                ]}
              >
                <Icon name="flash" size={20} color="primary" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {view.linkEntryOpen ? (
        <LinkEntrySheet
          onClose={() => dispatch({ kind: 'close-link-entry' })}
          onOpened={openVenue}
        />
      ) : null}
    </View>
  );
}

/** Replaces rather than stacks: a scanner left behind the event is a screen nobody wants back. */
function openVenue(venue: Venue) {
  router.replace(`/events/${venue.host}/${venue.pin}`);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  chrome: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'column',
  },
  topBarIos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.step * 4.5,
  },
  topBarAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 1.5,
    paddingHorizontal: spacing.step * 2,
    height: spacing.step * 16,
  },
  round: {
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIos: {
    textAlign: 'center',
  },
  titleAndroid: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  foot: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.step * 3,
  },
  prompt: {
    textAlign: 'center',
  },
  notice: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 3,
    marginTop: spacing.step * 2,
  },
  linkAction: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.step * 2.5,
  },
  torchIos: {
    flexGrow: 0,
    flexShrink: 0,
    width: spacing.pill + spacing.step / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchAndroid: {
    flexGrow: 0,
    flexShrink: 0,
    width: spacing.pill + spacing.step * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: spacing.pill + spacing.step / 2,
    borderRadius: radius.full,
  },
  squircle: {
    height: spacing.pill + spacing.step * 2,
    borderRadius: radius.lg,
  },
});
