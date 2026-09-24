import { create } from 'qrcode/lib/core/qrcode';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { qrModulesPath } from './qr-path';

const CODE_SIZE = 144;
const QUIET_ZONE = 12;

/**
 * The plate inverts in dark mode so the code stays dark-on-light in both schemes: scanners are
 * unreliable on an inverted QR.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { scheme, colors } = useTheme();
  const { size, path } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: 'M' });

    return {
      size: modules.size,
      path: qrModulesPath(modules.size, (row, col) => modules.get(row, col) === 1),
    };
  }, [value]);
  const dark = scheme === 'dark';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.plate, { backgroundColor: dark ? colors.foreground : colors.background }]}
    >
      <Svg width={CODE_SIZE} height={CODE_SIZE} viewBox={`0 0 ${size} ${size}`}>
        <Path d={path} fill={dark ? colors.background : colors.foreground} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'center',
    padding: QUIET_ZONE,
    borderRadius: radius.md,
  },
});
