import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import type { IconName } from './icons';

/** The one failure surface both public screens show. */
export function ErrorState({
  title,
  body,
  icon = 'unreachable',
  children,
}: {
  title: string;
  body: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  const colors = useColors();

  return (
    <ScrollView contentContainerStyle={styles.centre}>
      <Icon name={icon} size={28} color={colors.mutedForeground} />
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
    paddingHorizontal: spacing.overlay,
  },
  centred: { textAlign: 'center' },
});
