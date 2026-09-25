import { drawQr } from '@hallspeak/client-core/qr';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Image, Path } from 'react-native-svg';
import { useTheme } from '@/theme/provider';
import { radius } from '@/theme/tokens';

const CODE_SIZE = 200;
const QUIET_ZONE = 12;

const logoMark = require('../../assets/images/logo-mark-qr.png');

/**
 * The plate inverts in dark mode so the code stays dark-on-light in both schemes: scanners are
 * unreliable on an inverted QR. The logo is a raster because its shading uses multiply
 * blending, which react-native-svg does not implement.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { scheme, colors } = useTheme();
  const { size, path, logo } = useMemo(() => drawQr(value, { logo: true }), [value]);
  const dark = scheme === 'dark';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.plate, { backgroundColor: dark ? colors.foreground : colors.background }]}
    >
      <Svg width={CODE_SIZE} height={CODE_SIZE} viewBox={`0 0 ${size} ${size}`}>
        <Path d={path} fillRule="evenodd" fill={dark ? colors.background : colors.foreground} />
        {logo ? (
          <Image
            href={logoMark}
            x={logo.offset}
            y={logo.offset}
            width={logo.size}
            height={logo.size}
          />
        ) : null}
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
