import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

/** The wordmark, in Space Grotesk, with the teal mark that means what can be pressed. */
export function LogoLockup() {
  const colors = useColors();

  return (
    <View style={styles.lockup}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]} />
      <Text style={[styles.wordmark, { color: colors.foreground }]}>Hallspeak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 16, height: 16, borderRadius: 4 },
  wordmark: type.wordmark,
});
