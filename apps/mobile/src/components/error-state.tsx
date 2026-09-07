import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * The one failure surface both public screens show. It scrolls so the pull-to-refresh that
 * recovers from it is available on the failure itself, not only once something rendered.
 */
export function ErrorState({
  title,
  body,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  body: string;
  refreshing: boolean;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const colors = useColors();

  return (
    <ScrollView
      contentContainerStyle={styles.centre}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Icon name="unreachable" size={28} color={colors.mutedForeground} />
      <Text style={[type.title, styles.centred, { color: colors.foreground }]}>{title}</Text>
      <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>{body}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
  },
  centred: { textAlign: 'center' },
});
