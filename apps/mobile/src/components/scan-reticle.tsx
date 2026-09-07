import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/provider';

const WINDOW = 262;
const CORNER = 52;
const STROKE = 3;
// iOS rounds its window further than Android's, matching each platform's own shape language.
const WINDOW_RADIUS = Platform.OS === 'ios' ? 30 : 22;

/**
 * The scrim and the window it leaves. The design darkens the whole camera field except the
 * square the guest is meant to aim, which is what tells them where to point without anything
 * moving — the product's only two animations are tied to audio, and a sweeping laser would
 * claim work that is not happening.
 *
 * The web original is one box-shadow with a 2000px spread. React Native has no spread, so the
 * scrim is four rectangles around the window instead.
 */
export function ScanReticle() {
  const colors = useColors();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.scrimRow, styles.fill]} />
      <View style={styles.middleRow}>
        <View style={[styles.scrimRow, styles.fill]} />
        <View style={styles.window}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View
              key={corner}
              style={[styles.corner, CORNERS[corner], { borderColor: colors.primary }]}
            />
          ))}
        </View>
        <View style={[styles.scrimRow, styles.fill]} />
      </View>
      <View style={[styles.scrimRow, styles.fill]} />
    </View>
  );
}

const CORNERS = {
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: WINDOW_RADIUS,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: WINDOW_RADIUS,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderBottomLeftRadius: WINDOW_RADIUS,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderBottomRightRadius: WINDOW_RADIUS,
  },
} as const;

const styles = StyleSheet.create({
  // The scrim is the room dimmed, not a themed surface, so it is a literal in both schemes.
  scrimRow: { backgroundColor: 'rgba(6,12,20,0.58)' },
  fill: { flex: 1 },
  middleRow: { flexDirection: 'row', height: WINDOW },
  window: { width: WINDOW, height: WINDOW },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
});
