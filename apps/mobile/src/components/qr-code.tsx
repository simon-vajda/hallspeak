import { drawQr } from '@hallspeak/client-core/qr';
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/provider';
import { radius } from '@/theme/tokens';

export const QR_QUIET_ZONE = 12;

const logoMark = require('../../assets/images/logo-mark-qr.png');

/**
 * The plate inverts in dark mode so the code stays dark-on-light in both schemes: scanners are
 * unreliable on an inverted QR. The logo is a raster because its shading uses multiply
 * blending, which react-native-svg does not implement. It is a React Native `Image` laid over
 * the code rather than an SVG `Image`: react-native-svg decodes a raster at its width in viewBox
 * units, which here are QR modules, so the mark would be decoded a few pixels wide and upscaled.
 */
export function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const { scheme, colors } = useTheme();
  const { size: modules, path, logo } = useMemo(() => drawQr(value, { logo: true }), [value]);
  const dark = scheme === 'dark';
  const scale = size / modules;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.plate, { backgroundColor: dark ? colors.foreground : colors.background }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`}>
        <Path d={path} fillRule="evenodd" fill={dark ? colors.background : colors.foreground} />
      </Svg>
      {logo ? (
        <Image
          source={logoMark}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: QR_QUIET_ZONE + logo.offset * scale,
            top: QR_QUIET_ZONE + logo.offset * scale,
            width: logo.size * scale,
            height: logo.size * scale,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'center',
    padding: QR_QUIET_ZONE,
    borderRadius: radius.md,
  },
});
