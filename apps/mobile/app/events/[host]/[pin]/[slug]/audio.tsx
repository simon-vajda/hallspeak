import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { NativeSlider } from '@/components/native-controls';
import { SheetChrome } from '@/components/sheet-chrome';
import { SheetOption, SheetOptions } from '@/components/sheet-list';
import {
  AUDIO_SHEET_TITLE,
  AUDIO_SHEET_UNAVAILABLE_NOTE,
  DEFAULT_OUTPUTS,
  DEFAULT_VOLUME_STATE,
  isSilent,
  MAX_VOLUME,
  MIN_VOLUME,
  MUTE_LABEL,
  OUTPUT_NOTE,
  OUTPUT_SECTION_TITLE,
  selectOutput,
  setVolume,
  toggleMute,
  UNMUTE_LABEL,
  VOLUME_SECTION_TITLE,
  volumeLabel,
} from '@/screens/audio-sheet';
import { useColors } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { MONO_FONT, type } from '@/theme/typography';

const ANDROID = Platform.OS === 'android';

export default function AudioSheet() {
  const colors = useColors();
  const router = useRouter();
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME_STATE);

  const silent = isSilent(volume);

  return (
    <SheetChrome title={AUDIO_SHEET_TITLE} onDone={() => router.back()}>
      <View style={styles.section}>
        <Text style={[type.label, { color: colors.mutedForeground }]}>
          {OUTPUT_SECTION_TITLE.toUpperCase()}
        </Text>
        <SheetOptions>
          {outputs.map((output, index) => (
            <SheetOption
              key={output.id}
              index={index}
              count={outputs.length}
              label={output.label}
              selected={output.selected}
              leading={
                ANDROID ? (
                  <View
                    style={[
                      styles.radio,
                      { borderColor: output.selected ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {output.selected ? (
                      <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                    ) : null}
                  </View>
                ) : undefined
              }
              trailing={
                !ANDROID && output.selected ? (
                  <Icon name="confirm" size={18} color={colors.primary} strokeWidth={2.5} />
                ) : undefined
              }
              onPress={() => setOutputs(selectOutput(outputs, output.id))}
            />
          ))}
        </SheetOptions>
        <Text style={[type.note, { color: colors.mutedForeground }]}>{OUTPUT_NOTE}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.volumeHeading}>
          <Text style={[type.label, { color: colors.mutedForeground }]}>
            {VOLUME_SECTION_TITLE.toUpperCase()}
          </Text>
          <Text style={[styles.readout, { color: colors.foreground }]}>{volumeLabel(volume)}</Text>
        </View>

        <View style={styles.volumeRow}>
          {/* The speaker is the mute control, and it shows the muted glyph whenever the
              level is zero — including when the slider itself was dragged there. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={silent ? UNMUTE_LABEL : MUTE_LABEL}
            accessibilityState={{ selected: silent }}
            onPress={() => setVolumeState(toggleMute(volume))}
            style={[styles.speaker, { backgroundColor: colors.card }]}
          >
            <Icon
              name={silent ? 'muted' : 'volume'}
              size={ANDROID ? 20 : 19}
              color={silent ? colors.mutedForeground : colors.foreground}
              strokeWidth={2.25}
            />
          </Pressable>

          <View style={styles.slider}>
            <NativeSlider
              value={volume.volume}
              min={MIN_VOLUME}
              max={MAX_VOLUME}
              onValueChange={(next) => setVolumeState(setVolume(volume, next))}
            />
          </View>
        </View>
      </View>

      <Text style={[type.meta, { color: colors.mutedForeground }]}>
        {AUDIO_SHEET_UNAVAILABLE_NOTE}
      </Text>
    </SheetChrome>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: radius.full },
  volumeHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readout: { fontFamily: MONO_FONT, fontSize: 12, fontWeight: '600' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  speaker: {
    width: ANDROID ? 48 : 44,
    height: ANDROID ? 48 : 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { flex: 1 },
});
