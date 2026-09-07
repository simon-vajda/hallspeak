import { useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/theme/provider';

const WINDOW = 262;
const CORNER = 52;
const STROKE = 3;
// iOS rounds its window further than Android's, matching each platform's own shape language.
const RADIUS = Platform.OS === 'ios' ? 30 : 22;

/**
 * The scrim and the window it leaves. The design darkens the whole camera field except the
 * square the guest is meant to aim, which is what tells them where to point without anything
 * moving — the product's only two animations are tied to audio, and a sweeping laser would
 * claim work that is not happening.
 *
 * The hole is cut with an even-odd fill rather than four rectangles around it: the corner
 * brackets are rounded, and a square hole leaves the scrim visibly out of register with them.
 */
export function ScanReticle() {
  const colors = useColors();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setSize(nativeEvent.layout);

  const left = (size.width - WINDOW) / 2;
  const top = (size.height - WINDOW) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height}>
          <Path
            d={`${outerRect(size.width, size.height)} ${roundedRect(left, top, WINDOW, RADIUS)}`}
            // The room dimmed, not a themed surface: a literal in both schemes.
            fill="rgba(6,12,20,0.58)"
            fillRule="evenodd"
          />
        </Svg>
      ) : null}
      <View style={[styles.window, { left, top }]}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <View
            key={corner}
            style={[styles.corner, CORNERS[corner], { borderColor: colors.primary }]}
          />
        ))}
      </View>
    </View>
  );
}

const outerRect = (width: number, height: number) => `M0 0H${width}V${height}H0Z`;

/** Clockwise, so the even-odd rule reads it as a hole in the rectangle before it. */
function roundedRect(x: number, y: number, size: number, r: number) {
  const right = x + size;
  const bottom = y + size;

  return [
    `M${x + r} ${y}`,
    `H${right - r}`,
    `A${r} ${r} 0 0 1 ${right} ${y + r}`,
    `V${bottom - r}`,
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${bottom - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

const CORNERS = {
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: RADIUS,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: RADIUS,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderBottomLeftRadius: RADIUS,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderBottomRightRadius: RADIUS,
  },
} as const;

const styles = StyleSheet.create({
  window: { position: 'absolute', width: WINDOW, height: WINDOW },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
});
