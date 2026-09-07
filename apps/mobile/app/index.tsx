import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/action-button';
import { HistoryRow } from '@/components/history-row';
import { Icon } from '@/components/icon';
import { LogoLockup } from '@/components/logo-lockup';
import { Snackbar } from '@/components/snackbar';
import type { HistoryEntry } from '@/history/history';
import { listHistorySync, removeEvent, restoreEvent, setEventPinned } from '@/history/store';
import { eventHref } from '@/links/route';
import {
  EMPTY_HISTORY_BODY,
  EMPTY_HISTORY_TITLE,
  HISTORY_FOOTER,
  sectionHistory,
} from '@/screens/home-list';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  // Read synchronously on the first render: kv-store supports it, so pinned rows paint on the
  // first frame instead of after an empty flash.
  const [entries, setEntries] = useState<HistoryEntry[]>(listHistorySync);
  const [removed, setRemoved] = useState<HistoryEntry | null>(null);

  // Re-read on focus as well as on pull: an event opened and returned from is already in
  // memory, and asking the guest to pull for a row they just created is a lie about where
  // the list comes from. Both paths open no connection.
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

  const section = (title: string, rows: HistoryEntry[]) =>
    rows.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={[type.label, styles.sectionLabel, { color: colors.mutedForeground }]}>
          {title.toUpperCase()}
        </Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      >
        <View style={styles.header}>
          <LogoLockup />
          <Text style={[type.screen, { color: colors.foreground }]}>Listen</Text>
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
            {section('Pinned', pinned)}
            {section('Recent', recent)}
          </>
        )}

        <Text style={[type.meta, styles.centred, { color: colors.mutedForeground }]}>
          {HISTORY_FOOTER}
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
  content: { paddingHorizontal: 16, paddingBottom: 44, gap: 22 },
  header: { gap: 6, paddingTop: 12, paddingHorizontal: 4 },
  actions: { gap: 10 },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 16 },
  group: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
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
