import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { eventQueryOptions } from '@/api/queries';
import { ActionButton } from '@/components/action-button';
import { ChannelRow } from '@/components/channel-row';
import { Icon } from '@/components/icon';
import { markEventUnavailable, rememberEvent } from '@/history/store';
import { displayHost } from '@/links/host';
import { channelHref, readHostSegment } from '@/links/route';
import {
  CHOOSE_A_CHANNEL,
  channelReading,
  EVENT_REFRESH_NOTE,
  eventErrorMessage,
  NO_CHANNELS_BODY,
  NO_CHANNELS_TITLE,
} from '@/screens/event-view';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function EventScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string }>();
  const host = readHostSegment(params.host);
  const pin = params.pin ?? '';

  const query = useQuery(eventQueryOptions(host, pin));
  const event = query.data;

  // Opening the event is what writes it down, and what clears an earlier failure to reach
  // it. A failure marks the row when one exists and invents nothing when it does not.
  useEffect(() => {
    if (event) {
      rememberEvent({ host, pin, name: event.name, at: Date.now() });
    }
  }, [event, host, pin]);

  useEffect(() => {
    if (query.isError) {
      markEventUnavailable({ host, pin });
    }
  }, [query.isError, host, pin]);

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
        <ActionButton
          label="Back to your events"
          icon="back"
          variant="outlined"
          onPress={() => router.dismissTo('/')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refresh}
    >
      {event ? (
        <>
          <View style={styles.header}>
            <Text style={[type.screen, { color: colors.foreground }]}>{event.name}</Text>
            {event.description ? (
              <Text style={[type.bodyLg, { color: colors.mutedForeground }]}>
                {event.description}
              </Text>
            ) : null}
            <View style={[styles.hostChip, { backgroundColor: colors.secondary }]}>
              <Text style={[type.meta, { color: colors.mutedForeground }]}>
                {displayHost(host)}
              </Text>
            </View>
          </View>

          {event.channels.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Text style={[type.section, { color: colors.foreground }]}>{NO_CHANNELS_TITLE}</Text>
              <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
                {NO_CHANNELS_BODY}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              <Text style={[type.label, { color: colors.mutedForeground }]}>
                {CHOOSE_A_CHANNEL.toUpperCase()}
              </Text>
              {event.channels.map((channel) => (
                <ChannelRow
                  key={channel.slug}
                  name={channel.name}
                  reading={channelReading(channel.online, query.isSuccess)}
                  onPress={() => router.push(channelHref(host, pin, channel.slug))}
                />
              ))}
              <Text style={[type.meta, { color: colors.mutedForeground }]}>
                {EVENT_REFRESH_NOTE}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 40, gap: 22 },
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
  },
  centred: { textAlign: 'center' },
  header: { gap: 10, paddingTop: 4 },
  hostChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  list: { gap: 10 },
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: spacing.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
