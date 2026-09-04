import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { VenueRow } from '@/components/venue-row';
import { elevation, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { forgetEvent, readRememberedEvents, setEventPinned } from '@/venues/storage';
import {
  buildVenueList,
  EMPTY_STATE,
  STORAGE_NOTE,
  type VenueListView,
  type VenueRow as VenueRowData,
} from '@/venues/venue-list';

const EMPTY_VIEW: VenueListView = { kind: 'empty' };

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<VenueListView>(EMPTY_VIEW);

  const refresh = useCallback(async () => {
    setView(buildVenueList(await readRememberedEvents()));
  }, []);

  // Re-read on focus rather than on mount: opening an event rewrites the record this list shows.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openVenue = useCallback((row: VenueRowData) => {
    router.push(`/events/${row.host}/${row.pin}`);
  }, []);

  const togglePinned = useCallback(
    (row: VenueRowData) => {
      void setEventPinned(row.host, row.pin, !row.pinned).then(refresh);
    },
    [refresh],
  );

  const removeVenue = useCallback(
    (row: VenueRowData) => {
      Alert.alert(`Remove ${row.name}?`, 'It stays on the server; this only forgets it here.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void forgetEvent(row.host, row.pin).then(refresh);
          },
        },
      ]);
    },
    [refresh],
  );

  /**
   * The shared link-entry sheet is the single thing this action needs and it does not exist
   * yet; this is the one call site to point at it.
   */
  const pasteLink = useCallback(() => {}, []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.step * 3, paddingBottom: insets.bottom + spacing.panel },
      ]}
    >
      <View style={styles.lockup}>
        <View style={[styles.mark, { backgroundColor: theme.colors.primary }]} />
        <Text variant="section">LinguaCast</Text>
      </View>

      <Text variant="hero" style={styles.title}>
        Listen
      </Text>
      <Text variant="body" color="mutedForeground" style={styles.lede}>
        Scan the code at your venue, or pick up where you left off.
      </Text>

      <View style={styles.actions}>
        <HomeAction
          label="Scan QR code"
          icon="qr"
          iconSize={23}
          emphasis="primary"
          onPress={() => router.push('/scan')}
        />
        <HomeAction
          label="Paste a link"
          icon="link"
          iconSize={20}
          emphasis="secondary"
          onPress={pasteLink}
        />
      </View>

      {view.kind === 'empty' ? (
        <Surface style={styles.empty}>
          <Text variant="subtitle">{EMPTY_STATE.title}</Text>
          <Text variant="note" color="mutedForeground">
            {EMPTY_STATE.body}
          </Text>
        </Surface>
      ) : (
        view.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text variant="label" color="mutedForeground" uppercase style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Surface
              padded={false}
              style={section.id === 'pinned' ? { borderColor: theme.colors.primary } : undefined}
            >
              {section.rows.map((row, index) => (
                <View key={row.key}>
                  {index === 0 ? null : (
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                  )}
                  <VenueRow
                    row={row}
                    onOpen={openVenue}
                    onTogglePinned={togglePinned}
                    onRemove={removeVenue}
                  />
                </View>
              ))}
            </Surface>
          </View>
        ))
      )}

      <Text variant="note" color="mutedForeground" style={styles.note}>
        {STORAGE_NOTE}
      </Text>
    </ScrollView>
  );
}

type HomeActionProps = {
  label: string;
  icon: IconName;
  iconSize: number;
  emphasis: 'primary' | 'secondary';
  onPress: () => void;
};

function HomeAction({ label, icon, iconSize, emphasis, onPress }: HomeActionProps) {
  const theme = useTheme();
  const primary = emphasis === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? theme.colors.primary : theme.colors.secondary,
          height: primary ? spacing.pill + spacing.step * 3 : spacing.pill + spacing.step * 2,
        },
        primary ? elevation.goLive : null,
        pressed
          ? { backgroundColor: primary ? theme.colors.primaryHover : theme.colors.border }
          : null,
      ]}
    >
      <Icon name={icon} size={iconSize} color={primary ? 'primaryForeground' : 'foreground'} />
      <Text variant="section" color={primary ? 'primaryForeground' : 'foreground'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.step * 4,
    gap: spacing.step * 2,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 2,
    paddingHorizontal: spacing.step,
  },
  mark: {
    width: spacing.step * 4.5,
    height: spacing.step * 4.5,
    borderRadius: radius.full,
  },
  title: {
    marginTop: spacing.step * 3,
    paddingHorizontal: spacing.step,
  },
  lede: {
    paddingHorizontal: spacing.step,
    marginBottom: spacing.step * 3,
  },
  actions: {
    gap: spacing.step * 2.5,
    marginBottom: spacing.step * 4,
  },
  action: {
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.step * 2.5,
  },
  section: {
    gap: spacing.step * 2,
    marginBottom: spacing.step * 4,
  },
  sectionTitle: {
    paddingHorizontal: spacing.step * 4,
  },
  empty: {
    gap: spacing.step * 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.step * 5,
  },
  note: {
    paddingHorizontal: spacing.step,
    marginTop: spacing.step * 2,
  },
});
