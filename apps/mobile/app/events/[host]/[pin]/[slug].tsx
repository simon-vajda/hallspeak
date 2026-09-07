import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { channelQueryOptions } from '@/api/queries';
import { ActionButton } from '@/components/action-button';
import { ConnectionLine } from '@/components/connection-line';
import { GlassSurface } from '@/components/glass-surface';
import { Icon } from '@/components/icon';
import { ListenTarget } from '@/components/listen-target';
import { LiveBadge } from '@/components/live-badge';
import { rememberEvent } from '@/history/store';
import { audioSheetHref, readHostSegment, reportSheetHref } from '@/links/route';
import {
  AUDIO_ACTION_DETAIL,
  AUDIO_ACTION_LABEL,
  channelCopy,
  LISTEN_LABEL,
  LISTEN_UNAVAILABLE_NOTE,
  REPORT_ACTION_LABEL,
} from '@/screens/channel-copy';
import { channelReading, eventErrorMessage } from '@/screens/event-view';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function ChannelScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string }>();
  const host = readHostSegment(params.host);
  const pin = params.pin ?? '';
  const slug = params.slug ?? '';

  const query = useQuery(channelQueryOptions(host, pin, slug));
  const view = query.data;

  // The channel the guest chose is what the history row names next time.
  useEffect(() => {
    if (view) {
      rememberEvent({ host, pin, name: view.event.name, slug: view.channel.slug, at: Date.now() });
    }
  }, [view, host, pin]);

  const refresh = (
    <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
  );

  if (query.isError) {
    const message = eventErrorMessage(query.error);

    return (
      <ScrollView contentContainerStyle={styles.centre} refreshControl={refresh}>
        <Icon name="unreachable" size={28} color={colors.mutedForeground} />
        <Text style={[type.title, styles.centred, { color: colors.foreground }]}>
          {message.title}
        </Text>
        <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
          {message.body}
        </Text>
      </ScrollView>
    );
  }

  const reading = channelReading(view?.channel.online, query.isSuccess);
  const copy = channelCopy(reading);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refresh}
    >
      <View style={styles.header}>
        <Text style={[type.meta, { color: colors.mutedForeground }]}>
          {view ? `${view.event.name} · ${pin}` : ' '}
        </Text>
        {/* The slot is held in every state, the withheld one included. */}
        <View style={styles.badgeSlot}>
          {copy.badge ? (
            <LiveBadge live={reading === 'on-air'} label={copy.badge} />
          ) : (
            <Text style={[type.meta, { color: colors.mutedForeground }]}>
              {copy.accessibleBadge}
            </Text>
          )}
        </View>
        <Text style={[type.hero, { color: colors.foreground }]}>{view?.channel.name ?? ' '}</Text>
      </View>

      <View style={styles.stage}>
        <ListenTarget label={LISTEN_LABEL} disabled />
        <ConnectionLine />
        <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
          {copy.note}
        </Text>
        <Text style={[type.meta, styles.centred, { color: colors.mutedForeground }]}>
          {LISTEN_UNAVAILABLE_NOTE}
        </Text>
      </View>

      {/* Two unrelated jobs, so two surfaces rather than one row of buttons. */}
      <View style={styles.actions}>
        <GlassSurface style={styles.audioSurface}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={AUDIO_ACTION_LABEL}
            onPress={() => router.push(audioSheetHref(host, pin, slug))}
            style={styles.audioPress}
          >
            <Icon name="audio" size={20} color={colors.primary} />
            <View style={styles.audioText}>
              <Text style={[type.section, { color: colors.foreground }]}>{AUDIO_ACTION_LABEL}</Text>
              <Text style={[type.meta, { color: colors.mutedForeground }]}>
                {AUDIO_ACTION_DETAIL}
              </Text>
            </View>
            <Icon name="forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        </GlassSurface>

        <ActionButton
          label={REPORT_ACTION_LABEL}
          icon="report"
          variant="outlined"
          onPress={() => router.push(reportSheetHref(host, pin, slug))}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 36, gap: 22 },
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
  },
  centred: { textAlign: 'center' },
  header: { alignItems: 'center', gap: 8, paddingTop: 4 },
  badgeSlot: { minHeight: 26, justifyContent: 'center' },
  stage: { alignItems: 'center', gap: 12 },
  actions: { gap: 10 },
  audioSurface: { borderRadius: radius.lg },
  audioPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: spacing.touch + 16,
    paddingHorizontal: spacing.panel,
    paddingVertical: 14,
  },
  audioText: { flex: 1 },
});
