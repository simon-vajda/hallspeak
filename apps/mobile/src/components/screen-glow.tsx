import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useColors } from '@/theme/provider';

/**
 * The design's radial washes of brand colour behind a screen. They are iOS-only, as the
 * design draws them: liquid glass has nothing to refract over a flat ground, and a
 * full-screen gradient under a scrolling list costs real frames on mid-range Android, which
 * is why those frames are flat and use Material's tonal elevation instead.
 *
 * Each entry is one of the design's own `radial-gradient(<w> <h> at <x> <y>, primary <a>%,
 * transparent <stop>%)` layers, transcribed as fractions of the screen.
 */
type Wash = { cx: number; cy: number; rx: number; ry: number; opacity: number; stop: number };

const WASHES: Record<'home' | 'channel', Wash[]> = {
  home: [{ cx: 0.82, cy: 0.04, rx: 1, ry: 0.4, opacity: 0.26, stop: 0.72 }],
  channel: [
    { cx: 0.5, cy: 0.4, rx: 1.1, ry: 0.52, opacity: 0.22, stop: 0.7 },
    { cx: 0.5, cy: 0.88, rx: 0.9, ry: 0.44, opacity: 0.34, stop: 0.72 },
  ],
};

export function ScreenGlow({ variant }: { variant: keyof typeof WASHES }) {
  const colors = useColors();

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {WASHES[variant].map((wash, index) => (
            <RadialGradient
              // Each wash is a fixed entry in the table above, so its position is its identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: a static, fixed-length list.
              key={index}
              id={`${variant}-${index}`}
              cx={`${wash.cx * 100}%`}
              cy={`${wash.cy * 100}%`}
              rx={`${wash.rx * 100}%`}
              ry={`${wash.ry * 100}%`}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={colors.primary} stopOpacity={wash.opacity} />
              <Stop offset={`${wash.stop}`} stopColor={colors.primary} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        {WASHES[variant].map((_, index) => (
          <Rect
            // biome-ignore lint/suspicious/noArrayIndexKey: paired with the gradient above.
            key={index}
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${variant}-${index})`}
          />
        ))}
      </Svg>
    </View>
  );
}
