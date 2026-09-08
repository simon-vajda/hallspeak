import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { eventQueryOptions } from '@/api/queries';
import { ActionButton } from '@/components/action-button';
import { ChannelRow } from '@/components/channel-row';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { markEventUnavailable, rememberEvent } from '@/history/store';
import { displayHost } from '@/links/host';
import { channelHref, readEventParams } from '@/links/route';
import {
  BAD_ROUTE_MESSAGE,
  CHOOSE_A_CHANNEL,
  channelReadingFor,
  EVENT_REFRESH_NOTE,
  eventErrorMessage,
  NO_CHANNELS_BODY,
  NO_CHANNELS_TITLE,
} from '@/screens/event-view';
import { useEventSocket } from '@/socket/provider';
import { currentChannelStatus } from '@/socket/status';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

const IOS = Platform.OS === 'ios';

export default function EventScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string }>();
  const route = readEventParams(params.host, params.pin);
  const host = route?.host ?? '';
  const pin = route?.pin ?? '';

  const query = useQuery({ ...eventQueryOptions(host, pin), enabled: route !== null });
  const event = query.data;
  const { channelStatuses } = useEventSocket();

  // Opening the event is what writes it down, and what clears an earlier failure to reach
  // it. A failure marks the row when one exists and invents nothing when it does not.
  useEffect(() => {
    if (event) {
      rememberEvent({ host, pin, name: event.name, at: Date.now() });
    }
  }, [event, host, pin]);

  // Only a failure with nothing to show marks the row. A refetch that fails over a rendered
  // event has not established that the event is unreachable, and saying so would put a false
  // mark on the guest's own list.
  useEffect(() => {
    if (query.isError && event === undefined) {
      markEventUnavailable({ host, pin });
    }
  }, [query.isError, event, host, pin]);

  if (route === null) {
    return (
      <ErrorState title={BAD_ROUTE_MESSAGE.title} body={BAD_ROUTE_MESSAGE.body} icon="badLink">
        <ActionButton
          label="Back to your events"
          icon="back"
          variant="tonal"
          onPress={() => router.dismissTo('/')}
        />
      </ErrorState>
    );
  }

  if (query.isError && event === undefined) {
    const message = eventErrorMessage(query.error);

    return (
      <ErrorState
        title={message.title}
        body={message.body}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <ActionButton
          label="Back to your events"
          icon="back"
          variant="tonal"
          onPress={() => router.dismissTo('/')}
        />
      </ErrorState>
    );
  }

  const channels = event?.channels ?? [];

  return (
    <View style={styles.screen}>
      <ScreenHeader backHref="/" />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
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

            {channels.length === 0 ? (
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Text style={[type.section, { color: colors.foreground }]}>
                  {NO_CHANNELS_TITLE}
                </Text>
                <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
                  {NO_CHANNELS_BODY}
                </Text>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[type.label, { color: colors.mutedForeground }]}>
                  {CHOOSE_A_CHANNEL.toUpperCase()}
                </Text>
                {/* Separate cards on iOS, one connected Material list on Android: the gap is
                    what makes those two readings, so it lives beside the row's own shape. */}
                <View style={styles.list}>
                  {channels.map((channel, index) => (
                    <ChannelRow
                      key={channel.slug}
                      name={channel.name}
                      reading={channelReadingFor(
                        currentChannelStatus(channelStatuses[channel.slug], channel.online),
                      )}
                      index={index}
                      count={channels.length}
                      onPress={() => router.push(channelHref(host, pin, channel.slug))}
                    />
                  ))}
                </View>
                <Text style={[type.meta, { color: colors.mutedForeground }]}>
                  {EVENT_REFRESH_NOTE}
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: IOS ? 20 : 24, paddingTop: IOS ? 18 : 12, paddingBottom: 44 },
  centred: { textAlign: 'center' },
  header: { gap: 12 },
  hostChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  section: { gap: 12, paddingTop: IOS ? 24 : 26 },
  // The picker runs wider than the prose above it, as the design draws it.
  list: { gap: IOS ? 10 : 3, marginHorizontal: IOS ? -4 : -8 },
  empty: {
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: spacing.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
