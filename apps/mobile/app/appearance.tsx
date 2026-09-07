import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { SheetChoice } from '@/components/sheet-choice';
import { SheetChrome } from '@/components/sheet-chrome';
import { SheetOptions } from '@/components/sheet-list';
import { useTheme } from '@/theme/provider';
import { type } from '@/theme/typography';

const CHOICES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export default function AppearanceSheet() {
  const router = useRouter();
  const { colors, preference, setPreference, saveFailed } = useTheme();

  return (
    <SheetChrome title="Appearance" onDone={() => router.back()}>
      <SheetOptions>
        {CHOICES.map((choice, index) => (
          <SheetChoice
            key={choice.value}
            index={index}
            count={CHOICES.length}
            label={choice.label}
            selected={preference === choice.value}
            onPress={() => setPreference(choice.value)}
          />
        ))}
      </SheetOptions>
      <Text style={[type.note, { color: colors.mutedForeground }]}>
        System follows your device’s appearance.
      </Text>
      {saveFailed ? (
        <Text accessibilityRole="alert" style={[type.note, { color: colors.destructive }]}>
          Couldn’t save appearance. It may reset when you reopen the app.
        </Text>
      ) : null}
    </SheetChrome>
  );
}
