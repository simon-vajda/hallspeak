import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { channelQueryOptions } from '@/api/queries';
import { ConnectionLine } from '@/components/connection-line';
import { ErrorState } from '@/components/error-state';
import { GlassSurface } from '@/components/glass-surface';
import { Icon } from '@/components/icon';
import { ListenTarget } from '@/components/listen-target';
import { LiveBadge } from '@/components/live-badge';
import { ScreenHeader } from '@/components/screen-header';
import { rememberEvent } from '@/history/store';
import { audioSheetHref, eventHref, readChannelParams, reportSheetHref } from '@/links/route';
import {
  AUDIO_ACTION_DETAIL,
  AUDIO_ACTION_LABEL,
  channelCopy,
  LISTEN_LABEL,
  REPORT_ACTION_LABEL,
  STOP_LABEL,
} from '@/screens/channel-copy';
import { BAD_ROUTE_MESSAGE, channelReadingFor, eventErrorMessage } from '@/screens/event-view';
import { useEventSocket } from '@/socket/provider';
import { currentChannelStatus } from '@/socket/status';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

const IOS = Platform.OS === 'ios';

export default function ChannelScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string }>();
  const route = readChannelParams(params.host, params.pin, params.slug);
  const host = route?.host ?? '';
  const pin = route?.pin ?? '';
  const slug = route?.slug ?? '';

  const query = useQuery({
    ...channelQueryOptions(host, pin, slug),
    enabled: route !== null,
  });
  const view = query.data;
  const { socket, status, channelStatuses, joinChannel, leaveChannel } = useEventSocket();

  // Whether this guest has asked for the channel's audio. Intent and nothing more: no
  // consumer exists to derive it from yet, which is why a channel leaving the air clears it.
  const [listening, setListening] = useState(false);

  // Reaching a channel writes its event down; the channel itself is not remembered.
  useEffect(() => {
    if (view) {
      rememberEvent({ host, pin, name: view.event.name, at: Date.now() });
    }
  }, [view, host, pin]);

  const httpOnline = view?.channel.online;

  // A speaker is already in its channel room from the handshake; a listener has to ask. The
  // join is what makes this channel's status arrive, so it is re-issued on every reconnect.
  useEffect(() => {
    if (!socket || status !== 'connected' || slug === '' || httpOnline === undefined) {
      return;
    }

    void joinChannel(slug, httpOnline).catch(() => {
      // The status stays at its seed. Nothing here may print offline for a failed join.
    });

    return () => leaveChannel(slug);
  }, [socket, status, slug, httpOnline, joinChannel, leaveChannel]);

  const channelStatus = currentChannelStatus(channelStatuses[slug], httpOnline);
  const reading = channelReadingFor(channelStatus);
  const onAir = reading === 'on-air';

  // A channel leaving the air ends the intent with it, so the rings never outlive the
  // broadcast they were asked for.
  useEffect(() => {
    if (!onAir) {
      setListening(false);
    }
  }, [onAir]);

  if (route === null) {
    return (
      <ErrorState title={BAD_ROUTE_MESSAGE.title} body={BAD_ROUTE_MESSAGE.body} icon="badLink" />
    );
  }

  if (query.isError && view === undefined) {
    const message = eventErrorMessage(query.error);

    return (
      <ErrorState
        title={message.title}
        body={message.body}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      />
    );
  }

  const copy = channelCopy(reading);

  return (
    <View style={styles.screen}>
      <ScreenHeader backHref={eventHref(host, pin)} title={view?.event.name} />
      {/* The stage takes the height the screen has: the target sits in the middle of it,
          and the two actions stay at the thumb line however tall the phone is. */}
      <ScrollView
        contentContainerStyle={styles.stage}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
      >
        <View style={styles.badgeSlot}>
          {copy.badge ? (
            <LiveBadge live={reading === 'on-air'} label={copy.badge} />
          ) : (
            <Text style={[type.meta, { color: colors.mutedForeground }]}>
              {copy.accessibleBadge}
            </Text>
          )}
        </View>

        <Text numberOfLines={2} style={[type.hero, styles.centred, { color: colors.foreground }]}>
          {view?.channel.name ?? ' '}
        </Text>

        <ListenTarget
          label={listening ? STOP_LABEL : LISTEN_LABEL}
          active={listening}
          rings={listening}
          disabled={!onAir}
          onPress={() => setListening((was) => !was)}
        />

        <ConnectionLine />

        <Text style={[type.body, styles.note, { color: colors.mutedForeground }]}>{copy.note}</Text>
      </ScrollView>

      {/* Two unrelated jobs, so a wide surface and a separate one rather than a stack of
          equal buttons: the audio control reads its own state in its face. */}
      <View style={styles.thumbLine}>
        <GlassSurface interactive raised style={styles.audioSurface}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={AUDIO_ACTION_LABEL}
            accessibilityHint={AUDIO_ACTION_DETAIL}
            onPress={() => router.push(audioSheetHref(host, pin, slug))}
            style={styles.audioPress}
          >
            <Icon name="headphones" size={20} color={colors.foreground} strokeWidth={2.25} />
            <Text
              numberOfLines={1}
              style={[type.section, styles.audioLabel, { color: colors.foreground }]}
            >
              {AUDIO_ACTION_DETAIL}
            </Text>
          </Pressable>
        </GlassSurface>

        {/* Only a listener may report a problem: someone who has not pressed Listen has
            nothing to describe, and the five categories all name a fault in audio they
            would be receiving. */}
        {listening ? (
          <GlassSurface interactive raised style={IOS ? styles.reportRound : styles.reportSquircle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={REPORT_ACTION_LABEL}
              onPress={() => router.push(reportSheetHref(host, pin, slug))}
              style={styles.reportPress}
            >
              <Icon name="report" size={21} color={colors.foreground} strokeWidth={2.1} />
            </Pressable>
          </GlassSurface>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 32,
    paddingBottom: 96,
  },
  centred: { textAlign: 'center' },
  badgeSlot: { minHeight: 34, justifyContent: 'center' },
  note: { maxWidth: 300, textAlign: 'center' },
  thumbLine: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: IOS ? 34 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioSurface: { flex: 1, minWidth: 0, borderRadius: radius.full },
  audioPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: spacing.control,
    paddingHorizontal: 20,
  },
  audioLabel: { flex: 1, minWidth: 0 },
  reportRound: {
    width: spacing.control,
    height: spacing.control,
    borderRadius: spacing.control / 2,
  },
  reportSquircle: { width: spacing.control, height: spacing.control, borderRadius: 18 },
  reportPress: {
    width: spacing.control,
    height: spacing.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
