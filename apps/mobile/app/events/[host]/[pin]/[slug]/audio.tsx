import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { hasNamedOutput, outputLabel } from '@/audio/output';
import { isSilent, MAX_VOLUME, MIN_VOLUME, volumeLabel } from '@/audio/volume';
import { Icon } from '@/components/icon';
import { NativeSlider } from '@/components/native-controls';
import { SheetChrome } from '@/components/sheet-chrome';
import { SheetOption, SheetOptions } from '@/components/sheet-list';
import {
  AUDIO_SHEET_TITLE,
  CHANGE_OUTPUT_LABEL,
  MUTE_LABEL,
  OUTPUT_NOTE,
  OUTPUT_SECTION_TITLE,
  UNMUTE_LABEL,
  VOLUME_SECTION_TITLE,
} from '@/screens/audio-sheet';
import { useEventSocket } from '@/socket/provider';
import { useColors } from '@/theme/provider';
import { type } from '@/theme/typography';

const ANDROID = Platform.OS === 'android';
const SPEAKER = ANDROID ? 48 : 44;

export default function AudioSheet() {
  const colors = useColors();
  const router = useRouter();
  const { volume, output } = useEventSocket();

  const silent = isSilent(volume.state);

  return (
    <SheetChrome title={AUDIO_SHEET_TITLE} onDone={() => router.back()}>
      <View style={styles.section}>
        <Text style={[type.label, { color: colors.mutedForeground }]}>
          {OUTPUT_SECTION_TITLE.toUpperCase()}
        </Text>
        {/* One row, not a list: neither platform lets an app enumerate outputs, and the
            name is withheld rather than invented when the platform reported none. */}
        <SheetOptions>
          <SheetOption
            index={0}
            count={1}
            label={outputLabel(output.route)}
            {...(hasNamedOutput(output.route)
              ? {}
              : { tone: { background: colors.card, foreground: colors.mutedForeground } })}
            trailing={
              <Icon name="forward" size={18} color={colors.mutedForeground} strokeWidth={2.25} />
            }
            hint={CHANGE_OUTPUT_LABEL}
            onPress={output.present}
          />
        </SheetOptions>
        <Text style={[type.note, { color: colors.mutedForeground }]}>{OUTPUT_NOTE}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.volumeHeading}>
          <Text style={[type.label, { color: colors.mutedForeground }]}>
            {VOLUME_SECTION_TITLE.toUpperCase()}
          </Text>
          <Text style={[styles.readout, { color: colors.foreground }]}>
            {volumeLabel(volume.state)}
          </Text>
        </View>

        <View style={styles.volumeRow}>
          {/* The speaker is the mute control, and it shows the muted glyph whenever the
              level is zero — including when the slider itself was dragged there. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={silent ? UNMUTE_LABEL : MUTE_LABEL}
            accessibilityState={{ selected: silent }}
            onPress={volume.toggleMute}
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
              value={volume.state.volume}
              min={MIN_VOLUME}
              max={MAX_VOLUME}
              onValueChange={volume.setVolume}
            />
          </View>
        </View>
      </View>
    </SheetChrome>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  volumeHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readout: type.monoValue,
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  speaker: {
    width: SPEAKER,
    height: SPEAKER,
    borderRadius: SPEAKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { flex: 1 },
});
