import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

/** Scaffolding for the route skeleton. Every use is replaced before this run ships. */
export function PlaceholderScreen({ name, detail }: { name: string; detail?: string }) {
  const colors = useColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.title, { color: colors.foreground }]}>{name}</Text>
      {detail ? <Text style={[type.note, { color: colors.mutedForeground }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
