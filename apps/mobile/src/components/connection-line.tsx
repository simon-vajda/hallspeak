import { StyleSheet, View } from 'react-native';

/**
 * The slot the connection line will occupy. Its four states on the web run 17px to 47px
 * tall, so the height is reserved now: without it, a later audio round would move everything
 * below this line by 30px the moment audio starts.
 *
 * It is empty rather than a placeholder shape. There is no media leg behind it in this run,
 * and a drawn waveform with nothing feeding it would be a claim.
 */
export function ConnectionLine() {
  return <View style={styles.slot} />;
}

const styles = StyleSheet.create({
  slot: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
