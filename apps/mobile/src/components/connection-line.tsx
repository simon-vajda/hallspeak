import { StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/provider';

/** The design's waveform silhouette: tallest in the middle, tapering to both ends. */
const BARS = [5, 8, 11, 14, 16, 14, 11, 8, 5];

/**
 * The nine-bar link indicator. `filled` is how many bars the link is carrying, and it is 0
 * in this run for every state: the bars are graded from WebRTC statistics on the web, and
 * this app has no media leg behind them yet.
 *
 * The slot is reserved at the design's height either way, so the audio round that fills
 * these in moves nothing below them.
 */
export function ConnectionLine({ filled = 0 }: { filled?: number }) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {BARS.map((height, index) => (
        <View
          // The silhouette is symmetric, so heights repeat and the index is the identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length static bar row.
          key={index}
          style={[
            styles.bar,
            { height, backgroundColor: index < filled ? colors.live : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  bar: { width: 3, borderRadius: 2 },
});
