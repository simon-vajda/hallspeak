import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { Icon } from './icon';
import { SheetOption } from './sheet-list';

/** The shared single-selection row for appearance and audio output. */
export function SheetChoice({
  label,
  index,
  count,
  selected,
  onPress,
}: {
  label: string;
  index: number;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const android = Platform.OS === 'android';

  return (
    <SheetOption
      label={label}
      index={index}
      count={count}
      selected={selected}
      onPress={onPress}
      leading={
        android ? (
          <View
            style={[
              styles.radio,
              { borderColor: selected ? colors.primary : colors.mutedForeground },
            ]}
          >
            {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
          </View>
        ) : undefined
      }
      trailing={
        !android && selected ? (
          <Icon name="confirm" size={18} color={colors.primary} strokeWidth={2.5} />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
