import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/action-button';
import { HistoryRow } from '@/components/history-row';
import { Icon } from '@/components/icon';
import { LogoLockup } from '@/components/logo-lockup';
import type { HistoryEntry } from '@/history/history';
import { listHistorySync, removeEvent, setEventPinned } from '@/history/store';
import { channelHref, eventHref } from '@/links/route';
import {
  EMPTY_HISTORY_BODY,
  EMPTY_HISTORY_TITLE,
  HISTORY_FOOTER,
  removeActionLabel,
  sectionHistory,
} from '@/screens/home-list';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

type Row = { kind: 'heading'; title: string } | { kind: 'entry'; entry: HistoryEntry };

function toRows(entries: HistoryEntry[]): Row[] {
  const { pinned, recent } = sectionHistory(entries);
  const rows: Row[] = [];

  if (pinned.length > 0) {
    rows.push({ kind: 'heading', title: 'Pinned' });
    rows.push(...pinned.map((entry): Row => ({ kind: 'entry', entry })));
  }

  if (recent.length > 0) {
    rows.push({ kind: 'heading', title: 'Recent' });
    rows.push(...recent.map((entry): Row => ({ kind: 'entry', entry })));
  }

  return rows;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  // Read synchronously on the first render: kv-store supports it, so pinned rows paint on the
  // first frame instead of after an empty flash.
  const [entries, setEntries] = useState<HistoryEntry[]>(listHistorySync);

  // Pull-to-refresh re-reads device memory. This screen opens no connection of its own.
  const reload = useCallback(() => setEntries(listHistorySync()), []);

  const open = useCallback(
    (entry: HistoryEntry) => {
      router.push(
        entry.lastSlug
          ? channelHref(entry.host, entry.pin, entry.lastSlug)
          : eventHref(entry.host, entry.pin),
      );
    },
    [router],
  );

  const confirmRemove = useCallback((entry: HistoryEntry) => {
    Alert.alert(removeActionLabel(entry), 'This only forgets it on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setEntries(removeEvent({ host: entry.host, pin: entry.pin })),
      },
    ]);
  }, []);

  const togglePin = useCallback((entry: HistoryEntry) => {
    setEntries(setEventPinned({ host: entry.host, pin: entry.pin }, !entry.pinned));
  }, []);

  const rows = toRows(entries);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.kind === 'heading' ? `heading:${row.title}` : `${row.entry.host}:${row.entry.pin}`
        }
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <LogoLockup />
            <Text style={[type.screen, { color: colors.foreground }]}>Listen</Text>
            <Text style={[type.bodyLg, { color: colors.mutedForeground }]}>
              Scan the code at your venue, or pick up where you left off.
            </Text>
            <View style={styles.actions}>
              <ActionButton label="Scan QR code" icon="scan" onPress={() => router.push('/scan')} />
              <ActionButton
                label="Paste a link"
                icon="link"
                variant="outlined"
                onPress={() => router.push('/link')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Icon name="scan" size={22} color={colors.mutedForeground} />
            <Text style={[type.section, { color: colors.foreground }]}>{EMPTY_HISTORY_TITLE}</Text>
            <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
              {EMPTY_HISTORY_BODY}
            </Text>
          </View>
        }
        ListFooterComponent={
          <Text style={[type.meta, styles.centred, { color: colors.mutedForeground }]}>
            {HISTORY_FOOTER}
          </Text>
        }
        renderItem={({ item }) =>
          item.kind === 'heading' ? (
            <Text style={[type.label, styles.heading, { color: colors.mutedForeground }]}>
              {item.title.toUpperCase()}
            </Text>
          ) : (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={48}
              renderRightActions={() => (
                <View style={[styles.swipeAction, { backgroundColor: colors.destructiveMuted }]}>
                  <Icon name="remove" size={20} color={colors.destructive} />
                </View>
              )}
              onSwipeableOpen={() => confirmRemove(item.entry)}
            >
              <HistoryRow
                entry={item.entry}
                onOpen={() => open(item.entry)}
                onTogglePin={() => togglePin(item.entry)}
                onRemove={() => confirmRemove(item.entry)}
              />
            </ReanimatedSwipeable>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 40, gap: 10 },
  header: { gap: 10, paddingTop: 12, paddingBottom: 18 },
  actions: { gap: 10, paddingTop: 8 },
  heading: { paddingTop: 14, paddingBottom: 2 },
  centred: { textAlign: 'center' },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: spacing.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    marginLeft: 8,
    borderRadius: radius.lg,
  },
});
