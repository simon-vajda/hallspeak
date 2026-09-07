import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { NativeSlider, NativeSwitch } from '@/components/native-controls';
import { SheetChrome } from '@/components/sheet-chrome';
import {
  AUDIO_SHEET_TITLE,
  AUDIO_SHEET_UNAVAILABLE_NOTE,
  DEFAULT_OUTPUTS,
  DEFAULT_VOLUME,
  MAX_VOLUME,
  MIN_VOLUME,
  MUTE_LABEL,
  OUTPUT_NOTE,
  OUTPUT_SECTION_TITLE,
  selectOutput,
  VOLUME_SECTION_TITLE,
  volumeLabel,
} from '@/screens/audio-sheet';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function AudioSheet() {
  const colors = useColors();
  const router = useRouter();
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);

  return (
    <SheetChrome title={AUDIO_SHEET_TITLE} onDone={() => router.back()}>
      <View style={styles.body}>
        <View style={styles.section}>
          <Text style={[type.label, { color: colors.mutedForeground }]}>
            {OUTPUT_SECTION_TITLE.toUpperCase()}
          </Text>
          <View style={[styles.group, { borderColor: colors.border }]}>
            {outputs.map((output, index) => (
              <Pressable
                key={output.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: output.selected }}
                onPress={() => setOutputs(selectOutput(outputs, output.id))}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth },
                  { borderTopColor: colors.border },
                ]}
              >
                <Icon name="output" size={18} color={colors.mutedForeground} />
                <Text style={[type.body, styles.rowLabel, { color: colors.foreground }]}>
                  {output.label}
                </Text>
                {output.selected ? <Icon name="confirm" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
          <Text style={[type.meta, { color: colors.mutedForeground }]}>{OUTPUT_NOTE}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.volumeHeading}>
            <Text style={[type.label, { color: colors.mutedForeground }]}>
              {VOLUME_SECTION_TITLE.toUpperCase()}
            </Text>
            <Text style={[type.meta, { color: colors.mutedForeground }]}>
              {volumeLabel(volume, muted)}
            </Text>
          </View>
          <NativeSlider
            value={volume}
            min={MIN_VOLUME}
            max={MAX_VOLUME}
            step={1}
            disabled={muted}
            onValueChange={setVolume}
          />
          <NativeSwitch value={muted} label={MUTE_LABEL} onValueChange={setMuted} />
        </View>

        <Text style={[type.meta, { color: colors.mutedForeground }]}>
          {AUDIO_SHEET_UNAVAILABLE_NOTE}
        </Text>
      </View>
    </SheetChrome>
  );
}

const styles = StyleSheet.create({
  body: { gap: 22 },
  section: { gap: 10 },
  group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: spacing.touch,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: { flex: 1 },
  volumeHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
