import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { APPEARANCE_COPY } from '@/screens/appearance-copy';
import { useColors } from '@/theme/provider';
import { Icon } from './icon';

const SIZE = 48;

/** Home's appearance control on Android: Material's flat icon target opening the dialog. */
export function AppearanceButton() {
  const router = useRouter();
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={APPEARANCE_COPY.title}
      onPress={() => router.push('/appearance')}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="appearance" size={22} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
