import { showListenRings } from '@linguacast/client-core/channel';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
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
import { systemControls } from '@/audio/now-playing';
import { useNowPlaying } from '@/audio/use-now-playing';
import { ActionButton } from '@/components/action-button';
import { ConnectionLine } from '@/components/connection-line';
import { ErrorState } from '@/components/error-state';
import { GlassSurface } from '@/components/glass-surface';
import { Icon } from '@/components/icon';
import { ListenTarget } from '@/components/listen-target';
import { LiveBadge } from '@/components/live-badge';
import { ScreenHeader } from '@/components/screen-header';
import { rememberEvent } from '@/history/store';
import { eventHref, readChannelParams, reportSheetHref } from '@/links/route';
import { useListener } from '@/media/use-listener';
import {
  channelCopy,
  REPORT_ACTION_LABEL,
  TRY_AGAIN_LABEL,
  targetLabel,
} from '@/screens/channel-copy';
import { BAD_ROUTE_MESSAGE, eventErrorMessage } from '@/screens/event-view';
import { useEventSocket, useServerGate } from '@/socket/provider';
import { currentChannelStatus } from '@/socket/status';
import { useColors, useSurfaces } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

const IOS = Platform.OS === 'ios';

export default function ChannelScreen() {
  const colors = useColors();
  const surfaces = useSurfaces();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string }>();
  const route = readChannelParams(params.host, params.pin, params.slug);
  const host = route?.host ?? '';
  const pin = route?.pin ?? '';
  const slug = route?.slug ?? '';

  const gate = useServerGate();

  // No channel request runs before the server's version has been read and accepted.
  const query = useQuery({
    ...channelQueryOptions(host, pin, slug),
    enabled: route !== null && gate.check.state === 'ready',
  });
  const view = query.data;
  const { socket, status, channelStatuses, joinChannel, leaveChannel } = useEventSocket();

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

  // Intent is reconciled against the live facts rather than toggled by the press, so a
  // broadcast ending clears it, an interpreter dropping holds it, and a lost link outlives
  // it — the audio resumes by itself rather than asking the guest to press Listen again.
  const listener = useListener({
    slug,
    live: channelStatus?.online ?? false,
    muted: channelStatus?.muted ?? null,
    ...(channelStatus?.reason === undefined ? {} : { closeReason: channelStatus.reason }),
  });

  // The platform's own controls, held in step with the same intent the target reads, and
  // routed back into the same handlers — so the two can never disagree.
  useNowPlaying(
    systemControls({
      listening: listener.listening,
      paused: listener.paused,
      actionState: listener.actionState,
      isPlaying: listener.isPlaying,
      channelName: view?.channel.name ?? '',
      eventName: view?.event.name ?? '',
    }),
    { onPlay: listener.start, onPause: listener.stop },
  );

  if (route === null) {
    return (
      <ErrorState title={BAD_ROUTE_MESSAGE.title} body={BAD_ROUTE_MESSAGE.body} icon="badLink" />
    );
  }

  if (gate.check.state === 'blocked') {
    return (
      <ErrorState
        title={gate.check.title}
        body={gate.check.body}
        refreshing={gate.refreshing}
        onRefresh={gate.check.retryable ? () => gate.recheck() : undefined}
      >
        <ActionButton
          label="Back to this event"
          icon="back"
          variant="tonal"
          onPress={() => router.dismissTo(eventHref(host, pin))}
        />
      </ErrorState>
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

  const copy = channelCopy(
    channelStatus === undefined
      ? 'unknown'
      : {
          live: channelStatus.online,
          muted: channelStatus.muted,
          holding: listener.holding,
          linkConnected: listener.linkConnected,
          isPlaying: listener.isPlaying,
          ...(channelStatus.reason === undefined ? {} : { closeReason: channelStatus.reason }),
        },
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader backHref={eventHref(host, pin)} title={view?.event.name} />
      {/* The stage takes the height the screen has: the target sits in the middle of it,
          and the report action stays at the thumb line however tall the phone is. */}
      <ScrollView
        contentContainerStyle={styles.stage}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
      >
        <View style={styles.badgeSlot}>
          {copy.badge ? (
            <LiveBadge live={listener.hasLiveDot} label={copy.badge} />
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
          label={targetLabel(listener.actionState)}
          active={listener.actionState === 'playing'}
          loading={listener.actionState === 'holding'}
          // Muting stops new pulses while the existing rings settle into the target.
          rings={showListenRings(listener.isPlaying, channelStatus?.muted ?? null)}
          muted={channelStatus?.muted === true}
          disabled={listener.actionState === 'unavailable'}
          onPress={listener.actionState === 'playing' ? listener.stop : listener.start}
        />

        {/* Keep the slot's height stable, but show its contents only after Listen. Pausing
            withdraws intent, so the indicator disappears until the guest starts again. */}
        <View style={styles.lineSlot}>
          {listener.listening ? (
            <>
              <ConnectionLine filled={listener.filledBars} />
              {listener.link.kind === 'idle' ? null : (
                <Text style={[type.meta, { color: colors.mutedForeground }]}>
                  {listener.linkLabel}
                </Text>
              )}
            </>
          ) : null}
        </View>

        {/* Held rather than conditional for the same reason: a note appearing must not
            move the target above it. */}
        <View style={styles.noteSlot}>
          {copy.note ? (
            <Text style={[type.body, styles.note, { color: colors.mutedForeground }]}>
              {copy.note}
            </Text>
          ) : null}
        </View>

        {/* The ladder restarted ICE, rebuilt the transport and still found no pair. There is
            no document to reload here, so what is offered is a fresh session. */}
        {listener.restartRecommended ? (
          <ActionButton
            label={TRY_AGAIN_LABEL}
            icon="retry"
            variant="tonal"
            onPress={listener.restart}
          />
        ) : null}
      </ScrollView>

      <View style={styles.thumbLine}>
        {/* Intent makes reporting available, including while the consumer is opening or
            the interpreter is briefly reconnecting. Matches the web's hasRequestedAudio. */}
        {listener.listening ? (
          <GlassSurface
            interactive
            raised
            fallbackColor={IOS ? colors.card : surfaces.high}
            style={styles.reportSurface}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={REPORT_ACTION_LABEL}
              onPress={() => router.push(reportSheetHref(host, pin, slug))}
              style={styles.reportPress}
            >
              <Icon name="report" size={21} color={colors.foreground} strokeWidth={2.1} />
              <Text style={[type.section, { color: colors.foreground }]}>
                {REPORT_ACTION_LABEL}
              </Text>
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
  lineSlot: { minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noteSlot: { minHeight: 40, justifyContent: 'center' },
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
  reportSurface: {
    flex: 1,
    borderRadius: radius.full,
    height: spacing.control,
    ...(IOS ? {} : { borderWidth: 0 }),
  },
  reportPress: {
    height: spacing.control,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
