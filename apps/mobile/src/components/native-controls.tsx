import { Host, Slider, Switch } from '@expo/ui';
import { StyleSheet } from 'react-native';
import { SEED_COLOR, useTheme } from '@/theme/provider';

/**
 * The two `@expo/ui` controls this app uses, each behind one wrapper so a regression in a
 * young library is one file to change. These are the controls a listener notices most keenly
 * as fakes; everything carrying brand meaning stays plain React Native.
 *
 * `matchContents` is vertical only — a `Host` neither hugs nor stretches by default, and a
 * slider that hugs its content is a slider nobody can aim at.
 */
export function NativeSlider({
  value,
  min,
  max,
  step,
  disabled,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (next: number) => void;
}) {
  const { scheme } = useTheme();

  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={scheme}
      seedColor={SEED_COLOR}
      style={styles.host}
    >
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={onValueChange}
      />
    </Host>
  );
}

export function NativeSwitch({
  value,
  label,
  onValueChange,
}: {
  value: boolean;
  label?: string;
  onValueChange: (next: boolean) => void;
}) {
  const { scheme } = useTheme();

  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={scheme}
      seedColor={SEED_COLOR}
      style={styles.host}
    >
      <Switch value={value} label={label} onValueChange={onValueChange} />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: 'center' },
});
