import { Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Alert } from 'react-native';
import { APPEARANCE_CHOICES, APPEARANCE_COPY } from '@/screens/appearance-copy';
import type { ThemePreference } from '@/theme/preferences';
import { useTheme } from '@/theme/provider';

/**
 * iOS only: imported by the `.ios` menus. The appearance choice as SwiftUI draws it inside a `Menu`: `menu` nests it as a submenu
 * showing the current value, `inline` lists the choices in the menu itself. A menu has no room
 * for an inline message, so a failed save is reported by alert; the choice still applies for
 * the session.
 */
export function AppearancePicker({ style }: { style: 'menu' | 'inline' }) {
  const { preference, setPreference } = useTheme();

  const choose = (next: ThemePreference) => {
    if (!setPreference(next)) {
      Alert.alert(APPEARANCE_COPY.saveFailedTitle, APPEARANCE_COPY.saveFailedBody);
    }
  };

  return (
    <Picker
      label={APPEARANCE_COPY.title}
      systemImage="circle.lefthalf.filled"
      selection={preference}
      onSelectionChange={choose}
      modifiers={[pickerStyle(style)]}
    >
      {APPEARANCE_CHOICES.map((choice) => (
        <Text key={choice.value} modifiers={[tag(choice.value)]}>
          {choice.label}
        </Text>
      ))}
    </Picker>
  );
}
