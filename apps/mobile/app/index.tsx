import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

export default function HomeScreen() {
  const colors = useColors();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.screen, { color: colors.foreground }]}>Listen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
