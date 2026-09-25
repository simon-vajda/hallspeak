import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDialog } from '@/components/material-dialog';
import { ripple } from '@/components/press';
import { APPEARANCE_CHOICES, APPEARANCE_COPY } from '@/screens/appearance-copy';
import { useTheme } from '@/theme/provider';
import { withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';

/** Material's simple radio dialog: a choice applies and closes, unless it could not be saved. */
export default function AppearanceDialog() {
  const router = useRouter();
  const { colors, preference, setPreference, saveFailed } = useTheme();

  return (
    <MaterialDialog
      title={APPEARANCE_COPY.title}
      onDismiss={() => router.back()}
      actions={[{ label: APPEARANCE_COPY.cancel, onPress: () => router.back() }]}
    >
      <View accessibilityRole="radiogroup">
        {APPEARANCE_CHOICES.map((choice) => {
          const selected = preference === choice.value;

          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (setPreference(choice.value)) {
                  router.back();
                }
              }}
              android_ripple={ripple(withAlpha(colors.foreground, 0.12))}
              style={styles.row}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.primary : colors.mutedForeground },
                ]}
              >
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
              <Text style={[type.bodyLg, { color: colors.foreground }]}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.note, styles.note, { color: colors.mutedForeground }]}>
        {APPEARANCE_COPY.note}
      </Text>
      {saveFailed ? (
        <Text
          accessibilityRole="alert"
          style={[type.note, styles.note, { color: colors.destructive }]}
        >
          {APPEARANCE_COPY.saveFailed}
        </Text>
      ) : null}
    </MaterialDialog>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 24,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  note: { paddingHorizontal: 24, paddingTop: 8 },
});
