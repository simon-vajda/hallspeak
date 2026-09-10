import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';
import { BUILD_LABEL } from '@/version';

export function VersionLabel({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();

  const copy = useCallback(() => {
    void Clipboard.setStringAsync(BUILD_LABEL)
      .then(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      })
      .catch(() => {});
  }, []);

  return (
    <Pressable
      accessible
      accessibilityLabel={`Version ${BUILD_LABEL}`}
      accessibilityHint="Long press to copy"
      accessibilityActions={[{ name: 'copy', label: 'Copy version' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'copy') {
          copy();
        }
      }}
      onLongPress={copy}
      hitSlop={8}
      style={style}
    >
      <Text style={[type.meta, styles.centred, { color: colors.mutedForeground }]}>
        {BUILD_LABEL}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
});
