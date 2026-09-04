import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

/**
 * The camera field is whatever the room looks like, so its dimming and its window are fixed
 * values rather than theme roles. Primary is one value in both themes, so the corners are a
 * token rather than a transcription.
 */
const SCRIM = 'rgba(6, 12, 20, 0.58)';
const TINT = colors.light.primary;

const WINDOW = 262;
const ARM = 52;
const STROKE = 3;

export type ReticleProps = {
  /** iOS rounds the window further than Android; both sit on the radius scale. */
  cornerRadius?: number;
};

/**
 * Four corners rather than a closed frame, and nothing here moves: the only motion in this
 * product is tied to audio, and a sweeping line would claim work that is not happening.
 */
export function Reticle({ cornerRadius = radius.xl }: ReticleProps) {
  const corner = { borderColor: TINT, borderRadius: cornerRadius };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.scrim, { backgroundColor: SCRIM }]} />
      <View style={styles.band}>
        <View style={[styles.scrim, { backgroundColor: SCRIM }]} />
        <View style={styles.window}>
          <View style={[styles.corner, styles.topLeft, corner]} />
          <View style={[styles.corner, styles.topRight, corner]} />
          <View style={[styles.corner, styles.bottomLeft, corner]} />
          <View style={[styles.corner, styles.bottomRight, corner]} />
        </View>
        <View style={[styles.scrim, { backgroundColor: SCRIM }]} />
      </View>
      <View style={[styles.scrim, { backgroundColor: SCRIM }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
  },
  band: {
    flexDirection: 'row',
    height: WINDOW,
  },
  window: {
    width: WINDOW,
    height: WINDOW,
  },
  corner: {
    position: 'absolute',
    width: ARM,
    height: ARM,
  },
  topLeft: {
    left: 0,
    top: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
  },
  topRight: {
    right: 0,
    top: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
  },
});
