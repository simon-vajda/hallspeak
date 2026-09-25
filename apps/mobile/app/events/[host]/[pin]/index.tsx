import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { eventQueryOptions } from '@/api/queries';
import { ActionButton } from '@/components/action-button';
import { ChannelRow } from '@/components/channel-row';
import { ErrorState } from '@/components/error-state';
import { EventSkeleton, eventLayout } from '@/components/event-skeleton';
import { HeaderMenu } from '@/components/header-menu';
import { ScreenHeader } from '@/components/screen-header';
import { markEventUnavailable, rememberEvent } from '@/history/store';
import { displayHost } from '@/links/host';
import { channelHref, readEventParams, shareEventHref } from '@/links/route';
import {
  BAD_ROUTE_MESSAGE,
  CHOOSE_A_CHANNEL,
  channelReadingFor,
  EVENT_REFRESH_NOTE,
  eventErrorMessage,
  eventScreenState,
  NO_CHANNELS_BODY,
  NO_CHANNELS_TITLE,
} from '@/screens/event-view';
import { useEventSocket, useServerGate } from '@/socket/provider';
import { currentChannelStatus } from '@/socket/status';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function EventScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string }>();
  const route = readEventParams(params.host, params.pin);
  const host = route?.host ?? '';
  const pin = route?.pin ?? '';

  const gate = useServerGate();

  // No event request runs before the server's version has been read and accepted.
  const query = useQuery({
    ...eventQueryOptions(host, pin),
    enabled: route !== null && gate.check.state === 'ready',
  });
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

  const screen = eventScreenState({
    routeValid: route !== null,
    gate: gate.check.state,
    isError: query.isError,
    hasEvent: event !== undefined,
  });

  if (screen === 'bad-route') {
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

  if (screen === 'blocked' && gate.check.state === 'blocked') {
    return (
      <ErrorState title={gate.check.title} body={gate.check.body}>
        <ActionButton
          label="Back to your events"
          icon="back"
          variant="tonal"
          onPress={() => router.dismissTo('/')}
        />
      </ErrorState>
    );
  }

  if (screen === 'error') {
    const message = eventErrorMessage(query.error);

    return (
      <ErrorState title={message.title} body={message.body}>
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
      <ScreenHeader
        backHref="/"
        menu={
          <HeaderMenu shareHref={event === undefined ? undefined : shareEventHref({ host, pin })} />
        }
      />
      <ScrollView
        contentContainerStyle={eventLayout.content}
        contentInsetAdjustmentBehavior="never"
      >
        {event === undefined ? (
          <EventSkeleton />
        ) : (
          <>
            <View style={eventLayout.header}>
              <Text style={[type.screen, { color: colors.foreground }]}>{event.name}</Text>
              {event.description ? (
                <Text style={[type.bodyLg, { color: colors.mutedForeground }]}>
                  {event.description}
                </Text>
              ) : null}
              <View style={[eventLayout.hostChip, { backgroundColor: colors.secondary }]}>
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
              <View style={eventLayout.section}>
                <Text style={[type.label, { color: colors.mutedForeground }]}>
                  {CHOOSE_A_CHANNEL.toUpperCase()}
                </Text>
                {/* Separate cards on iOS, one connected Material list on Android: the gap is
                    what makes those two readings, so it lives beside the row's own shape. */}
                <View style={eventLayout.list}>
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
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { textAlign: 'center' },
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
