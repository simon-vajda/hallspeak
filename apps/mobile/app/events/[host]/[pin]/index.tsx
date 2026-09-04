import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChannelRow } from '@/components/channel-row';
import { Icon, type IconName } from '@/components/icon';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { openEvent } from '@/venues/client';
import {
  buildEventView,
  type ChannelRowView,
  type EventView,
  PICKER_LABEL,
} from '@/venues/event-view';
import { readRememberedEvents, setEventPinned } from '@/venues/storage';

/** The host is identity rather than prose, and mono type is what says so wherever it appears. */
const MONO_FAMILY = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function EventScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ host: string; pin: string }>();
  const host = params.host ?? '';
  const pin = params.pin ?? '';

  const [view, setView] = useState<EventView | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pinned, setPinned] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    // The host and PIN come from the route, so an event scanned at the door opens without
    // ever having been remembered.
    const lookup = await openEvent(host, pin);
    setView(buildEventView(lookup, host));

    const remembered = (await readRememberedEvents()).find(
      (event) => event.host === host && event.pin === pin,
    );
    setPinned(remembered?.pinned ?? null);
  }, [host, pin]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  const openChannel = useCallback(
    (row: ChannelRowView) => {
      router.push(`/events/${host}/${pin}/${row.slug}`);
    },
    [host, pin],
  );

  const togglePinned = useCallback(() => {
    if (pinned === null) {
      return;
    }
    void setEventPinned(host, pin, !pinned).then(() => setPinned(!pinned));
  }, [host, pin, pinned]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.step, paddingBottom: insets.bottom + spacing.panel },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={theme.colors.mutedForeground}
        />
      }
    >
      <View style={styles.bar}>
        <RoundButton label="Go back" icon="chev-l" onPress={goBack} />
        <View style={styles.spacer} />
        {pinned === null ? null : (
          <RoundButton
            label={pinned ? 'Unpin this event' : 'Pin this event'}
            icon={pinned ? 'star-filled' : 'star'}
            tint={pinned ? 'primary' : 'mutedForeground'}
            onPress={togglePinned}
          />
        )}
      </View>

      {view === null ? (
        <View style={styles.pending}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="note" color="mutedForeground">
            Looking for your event.
          </Text>
        </View>
      ) : view.kind === 'event' ? (
        <>
          <Text variant="screen" style={styles.title}>
            {view.name}
          </Text>
          {view.description === undefined ? null : (
            <Text variant="body" color="mutedForeground" style={styles.description}>
              {view.description}
            </Text>
          )}

          <View style={[styles.hostChip, { backgroundColor: theme.colors.secondary }]}>
            <View style={[styles.hostDot, { backgroundColor: theme.colors.mutedForeground }]} />
            <Text
              variant="meta"
              color="mutedForeground"
              numberOfLines={1}
              style={{ fontFamily: MONO_FAMILY }}
            >
              {view.host}
            </Text>
          </View>

          <Text variant="label" color="mutedForeground" uppercase style={styles.pickerLabel}>
            {PICKER_LABEL}
          </Text>

          {view.picker.kind === 'empty' ? (
            <Surface style={styles.message}>
              <Text variant="subtitle">{view.picker.title}</Text>
              <Text variant="note" color="mutedForeground">
                {view.picker.body}
              </Text>
            </Surface>
          ) : (
            <View style={styles.picker}>
              {view.picker.rows.map((row) => (
                <ChannelRow key={row.slug} row={row} onOpen={openChannel} />
              ))}
            </View>
          )}

          <Text variant="note" color="mutedForeground" style={styles.note}>
            {view.note}
          </Text>
        </>
      ) : (
        <Surface style={styles.message}>
          <Text variant="subtitle">{view.title}</Text>
          <Text variant="note" color="mutedForeground">
            {view.body}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: pressed ? theme.colors.primaryHover : theme.colors.primary },
            ]}
          >
            <Text variant="section" color="primaryForeground">
              Try again
            </Text>
          </Pressable>
        </Surface>
      )}
    </ScrollView>
  );
}

type RoundButtonProps = {
  label: string;
  icon: IconName;
  tint?: 'foreground' | 'mutedForeground' | 'primary';
  onPress: () => void;
};

function RoundButton({ label, icon, tint = 'foreground', onPress }: RoundButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: pressed ? theme.colors.hoverOverlayStrong : theme.colors.secondary },
      ]}
    >
      <Icon name={icon} size={typography.subtitle.fontSize} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.step * 4,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touch,
  },
  spacer: {
    flex: 1,
  },
  round: {
    width: spacing.action,
    height: spacing.action,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: {
    alignItems: 'center',
    gap: spacing.step * 3,
    paddingVertical: spacing.step * 12,
  },
  title: {
    marginTop: spacing.step * 4.5,
    paddingHorizontal: spacing.step,
  },
  description: {
    marginTop: spacing.step * 3,
    paddingHorizontal: spacing.step,
  },
  hostChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 2,
    marginTop: spacing.step * 4,
    marginLeft: spacing.step,
    paddingVertical: spacing.step * 2,
    paddingHorizontal: spacing.step * 3.5,
    borderRadius: radius.full,
  },
  hostDot: {
    width: spacing.step * 1.75,
    height: spacing.step * 1.75,
    borderRadius: radius.full,
  },
  pickerLabel: {
    marginTop: spacing.step * 6,
    marginBottom: spacing.step * 2,
    paddingHorizontal: spacing.step,
  },
  picker: {
    gap: spacing.step * 2.5,
  },
  message: {
    gap: spacing.step * 2,
    marginTop: spacing.step * 4,
  },
  retry: {
    marginTop: spacing.step * 2,
    height: spacing.pill,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: spacing.step * 6,
    paddingHorizontal: spacing.step,
  },
});
