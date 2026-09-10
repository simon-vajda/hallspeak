import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/action-button';
import { AppearanceButton } from '@/components/appearance-button';
import { HistoryRow } from '@/components/history-row';
import { Icon } from '@/components/icon';
import { LogoLockup } from '@/components/logo-lockup';
import { ScreenGlow } from '@/components/screen-glow';
import { Snackbar } from '@/components/snackbar';
import type { HistoryEntry } from '@/history/history';
import { listHistorySync, removeEvent, restoreEvent, setEventPinned } from '@/history/store';
import { eventHref } from '@/links/route';
import { EMPTY_HISTORY_BODY, EMPTY_HISTORY_TITLE, sectionHistory } from '@/screens/home-list';
import { useColors, useSurfaces } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { BUILD_LABEL } from '@/version';

const IOS = Platform.OS === 'ios';

export default function HomeScreen() {
  const colors = useColors();
  const surfaces = useSurfaces();
  const router = useRouter();
  // Read synchronously on the first render: kv-store supports it, so pinned rows paint on the
  // first frame instead of after an empty flash.
  const [entries, setEntries] = useState<HistoryEntry[]>(listHistorySync);
  const [removed, setRemoved] = useState<HistoryEntry | null>(null);

  // Re-read on focus: an event opened and returned from is already in memory, so the row
  // appears as soon as the guest comes back. This opens no connection.
  const reload = useCallback(() => setEntries(listHistorySync()), []);

  useFocusEffect(reload);

  // Always the picker, never a channel: the language someone wants belongs to this service
  // rather than the last one, and a row that opened a channel would make changing it a
  // back-navigation.
  const open = useCallback(
    (entry: HistoryEntry) => router.push(eventHref(entry.host, entry.pin)),
    [router],
  );

  /**
   * Removal happens and is then undoable, rather than being confirmed in advance: a modal
   * asks the guest to predict what they want before they can see it, and the alert both
   * platforms open for that is the least native-looking surface either still ships.
   */
  const remove = useCallback((entry: HistoryEntry) => {
    setEntries(removeEvent({ host: entry.host, pin: entry.pin }));
    setRemoved(entry);
  }, []);

  const undoRemove = useCallback(() => {
    if (!removed) {
      return;
    }

    setEntries(restoreEvent(removed));
    setRemoved(null);
  }, [removed]);

  const togglePin = useCallback((entry: HistoryEntry) => {
    setEntries(setEventPinned({ host: entry.host, pin: entry.pin }, !entry.pinned));
  }, []);

  const { pinned, recent } = useMemo(() => sectionHistory(entries), [entries]);

  /**
   * On Android the two sections sit on different steps of Material's tonal ladder, which is
   * that platform's own way of saying one group outranks the other. Tone alone, with no
   * shadow: a list group does not float above the page, and a shadow on one would make every
   * surface without one look unfinished. iOS says the same thing with glass and keeps both on
   * `card`, so nothing here changes there.
   */
  const section = (title: string, rows: HistoryEntry[], level: 'base' | 'high') => {
    const surface = IOS ? colors.card : surfaces[level];

    return rows.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={[type.label, styles.sectionLabel, { color: colors.mutedForeground }]}>
          {title.toUpperCase()}
        </Text>
        <View
          style={[
            styles.group,
            IOS ? null : styles.flat,
            { backgroundColor: surface, borderColor: colors.border },
          ]}
        >
          {rows.map((entry, index) => (
            <View key={`${entry.host}:${entry.pin}`}>
              {index > 0 ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
              <ReanimatedSwipeable
                friction={1.6}
                rightThreshold={72}
                overshootRight={false}
                renderRightActions={() => (
                  <View style={[styles.removePanel, { backgroundColor: colors.destructive }]}>
                    <Icon name="remove" size={19} color={colors.background} />
                    <Text style={[type.section, { color: colors.background }]}>Remove</Text>
                  </View>
                )}
                onSwipeableOpen={() => remove(entry)}
              >
                <HistoryRow
                  entry={entry}
                  surface={surface}
                  onOpen={() => open(entry)}
                  onTogglePin={() => togglePin(entry)}
                  onRemove={() => remove(entry)}
                />
              </ReanimatedSwipeable>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenGlow variant="home" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LogoLockup />
            <AppearanceButton />
          </View>
          <Text style={[type.screenLg, styles.title, { color: colors.foreground }]}>Join</Text>
          <Text style={[type.bodyLg, { color: colors.mutedForeground }]}>
            Scan the code at your venue, or pick up where you left off.
          </Text>
        </View>

        <View style={styles.actions}>
          <ActionButton label="Scan QR code" icon="scan" onPress={() => router.push('/scan')} />
          <ActionButton
            label="Paste a link"
            icon="link"
            variant="tonal"
            onPress={() => router.push('/link')}
          />
        </View>

        {entries.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Icon name="scan" size={22} color={colors.mutedForeground} />
            <Text style={[type.section, { color: colors.foreground }]}>{EMPTY_HISTORY_TITLE}</Text>
            <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
              {EMPTY_HISTORY_BODY}
            </Text>
          </View>
        ) : (
          <>
            {section('Pinned', pinned, 'high')}
            {section('Recent', recent, 'base')}
          </>
        )}

        <Text
          selectable
          style={[type.meta, styles.centred, styles.footer, { color: colors.mutedForeground }]}
        >
          {BUILD_LABEL}
        </Text>
      </ScrollView>

      {removed ? (
        <Snackbar
          message={`Removed ${removed.name}`}
          actionLabel="Undo"
          onAction={undoRemove}
          onDismiss={() => setRemoved(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // flexGrow with the footer's auto margin is what puts the footer at the bottom of a short
  // list and after the content of a long one.
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingBottom: 44, gap: 26 },
  footer: { marginTop: 'auto' },
  // The design gives the wordmark room above it and sets the title well clear of both the
  // mark and the line under it; the cramped version had all three on one 6px rhythm.
  header: { gap: 8, paddingTop: 22, paddingBottom: 4, paddingHorizontal: 4 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { marginTop: 14 },
  actions: { gap: 10 },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: spacing.gutter },
  group: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // A tonal surface carries no outline: the step already separates it from the page, and the
  // two together read as two answers to the same question.
  flat: { borderWidth: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.gutter },
  removePanel: {
    width: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  centred: { textAlign: 'center' },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: spacing.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
