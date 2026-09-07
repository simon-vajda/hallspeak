import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/theme/provider';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';

const IOS = Platform.OS === 'ios';
const SIZE = IOS ? 44 : 48;

export function AppearanceButton() {
  const router = useRouter();
  const colors = useColors();
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Appearance"
      onPress={() => router.push('/appearance')}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="appearance" size={22} color={colors.foreground} />
    </Pressable>
  );

  return IOS ? (
    <GlassSurface interactive raised style={styles.disc}>
      {button}
    </GlassSurface>
  ) : (
    button
  );
}

const styles = StyleSheet.create({
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
