import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

const logoMark = require('../../assets/images/logo-mark.png');

/**
 * The logo mark beside the wordmark in Space Grotesk. The mark is a raster because its
 * shading uses multiply blending, which react-native-svg does not implement.
 */
export function LogoLockup() {
  const colors = useColors();

  return (
    <View style={styles.lockup}>
      <Image source={logoMark} style={styles.mark} accessible={false} />
      <Text style={[styles.wordmark, { color: colors.foreground }]}>Hallspeak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 16, height: 24 },
  wordmark: type.wordmark,
});
