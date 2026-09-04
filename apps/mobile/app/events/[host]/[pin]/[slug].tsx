import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { ListenTarget } from '@/components/listen-target';
import { LiveBadge } from '@/components/live-badge';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { FIXTURE_ELAPSED_LABEL } from '@/fixtures/elapsed';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import {
  BACK_LABEL,
  type ChannelCopy,
  type ChannelState,
  channelCopy,
  PENDING_NOTE,
  RETRY_LABEL,
} from '@/venues/channel-copy';
import { openEvent } from '@/venues/client';

type Resolved = {
  state: ChannelState;
  /** The channel's own name, and the event's for the bar above it. */
  name: string;
  eventName: string;
};

export default function ChannelScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string }>();
  const host = params.host ?? '';
  const pin = params.pin ?? '';
  const slug = params.slug ?? '';

  const [resolved, setResolved] = useState<Resolved | null>(null);

  const load = useCallback(async () => {
    const lookup = await openEvent(host, pin);
    if (lookup.outcome === 'unreachable') {
      setResolved({ state: 'unreachable', name: slug, eventName: '' });
      return;
    }
    const channel =
      lookup.outcome === 'verified'
        ? lookup.event.channels.find((candidate) => candidate.slug === slug)
        : undefined;
    // A missing event and a missing channel are one outcome, matching the server's 404 parity.
    if (channel === undefined) {
      setResolved({ state: 'missing', name: slug, eventName: '' });
      return;
    }
    setResolved({
      state: channel.online ? 'on-air' : 'offline',
      name: channel.name,
      eventName: lookup.outcome === 'verified' ? lookup.event.name : '',
    });
  }, [host, pin, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  const copy: ChannelCopy | null =
    resolved === null
      ? null
      : channelCopy(
          resolved.state,
          resolved.state === 'on-air' ? FIXTURE_ELAPSED_LABEL : undefined,
        );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing.step * 2,
          paddingBottom: insets.bottom + spacing.step * 4,
        },
      ]}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={BACK_LABEL}
          onPress={goBack}
          style={({ pressed }) => [
            styles.back,
            pressed ? { backgroundColor: theme.colors.hoverOverlay } : null,
          ]}
        >
          <Icon name={BACK_ICON} size={spacing.step * 5} color="foreground" />
        </Pressable>
        <Text variant="meta" color="mutedForeground" numberOfLines={1} style={styles.barTitle}>
          {resolved?.eventName ?? ''}
        </Text>
        <View style={styles.back} />
      </View>

      {copy === null || resolved === null ? (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="note" color="mutedForeground">
            {PENDING_NOTE}
          </Text>
        </View>
      ) : copy.target === undefined ? (
        <View style={styles.centre}>
          <Surface style={styles.message}>
            <Text variant="subtitle">{copy.title}</Text>
            <Text variant="note" color="mutedForeground">
              {copy.note}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResolved(null);
                void load();
              }}
              style={({ pressed }) => [
                styles.retry,
                { backgroundColor: pressed ? theme.colors.primaryHover : theme.colors.primary },
              ]}
            >
              <Text variant="section" color="primaryForeground">
                {RETRY_LABEL}
              </Text>
            </Pressable>
          </Surface>
        </View>
      ) : (
        <>
          <View style={styles.centre}>
            {/* The slot is not reserved: a badge is a claim, and an absent one says nothing. */}
            {copy.badge === undefined ? null : <LiveBadge label={copy.badge} />}

            <Text variant="screenLg" style={styles.name}>
              {resolved.name}
            </Text>

            <ListenTarget label={copy.target.label} enabled={copy.target.enabled} />

            <ConnectionLine />

            <Text variant="body" color="mutedForeground" style={styles.note}>
              {copy.note}
            </Text>
          </View>

          <View style={styles.thumbLine}>
            <ActionPill label={copy.actions?.route ?? ''} />
            <ActionButton label={copy.actions?.report ?? ''} />
          </View>
        </>
      )}
    </View>
  );
}

/** iOS goes back with a chevron, Android with an arrow: the same gesture, each platform's mark. */
const BACK_ICON = Platform.select({ ios: 'chev-l', default: 'arrow-l' } as const);

/**
 * The design's waveform silhouette — tallest in the middle, tapering to both ends. Every bar
 * is drawn unfilled: the filled colour means audio is moving, and none is.
 */
const BARS = [5, 8, 11, 14, 16, 14, 11, 8, 5].map((height, index) => ({
  // The silhouette is symmetric, so heights repeat and only position identifies a bar.
  id: `bar-${index}`,
  height,
}));

function ConnectionLine() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.bars}
    >
      {BARS.map((bar) => (
        <View
          key={bar.id}
          style={[styles.bar, { height: bar.height, backgroundColor: theme.colors.border }]}
        />
      ))}
    </View>
  );
}

/**
 * The route control and the report action are unrelated jobs, so they never share one surface:
 * iOS separates them as two discs, Android as a pill beside a squircle.
 */
function ActionPill({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={[styles.pill, { backgroundColor: theme.colors.secondary }]}
    >
      <Icon name="head" size={spacing.step * 5.25} color="primary" />
      <Text variant="section" numberOfLines={1} style={styles.pillLabel}>
        {label}
      </Text>
    </View>
  );
}

function ActionButton({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: true }}
      style={[styles.square, { backgroundColor: theme.colors.secondary }]}
    >
      <Icon name="warn" size={spacing.step * 5.5} color="foreground" />
    </View>
  );
}

const ACTION_SIZE = spacing.step * 14;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.step * 4,
  },
  bar: {
    width: spacing.step * 0.75,
    borderRadius: spacing.step / 2,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.step * 0.75,
    height: spacing.step * 4,
  },
  back: {
    width: spacing.action,
    height: spacing.action,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTitle: {
    flex: 1,
    textAlign: Platform.select({ ios: 'center', default: 'left' }),
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.panel,
  },
  message: {
    alignSelf: 'stretch',
    gap: spacing.step * 2,
  },
  name: {
    textAlign: 'center',
  },
  note: {
    maxWidth: spacing.step * 70,
    textAlign: 'center',
  },
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 3,
    height: ACTION_SIZE,
    paddingHorizontal: spacing.step * 5,
    borderRadius: radius.full,
  },
  pillLabel: {
    flex: 1,
    minWidth: 0,
  },
  retry: {
    marginTop: spacing.step * 2,
    height: spacing.pill,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Platform.select({ ios: radius.full, default: spacing.step * 4.5 }),
  },
  thumbLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 3,
  },
});
