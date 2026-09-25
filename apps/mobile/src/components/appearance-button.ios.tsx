import { Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { APPEARANCE_COPY } from '@/screens/appearance-copy';
import { SEED_COLOR, useTheme } from '@/theme/provider';
import { AppearancePicker } from './appearance-picker';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';

const SIZE = 44;

/** Home's appearance control: a glass disc opening a native menu of the three choices. */
export function AppearanceButton() {
  const { scheme, colors } = useTheme();

  return (
    <GlassSurface interactive raised style={styles.disc}>
      <Host matchContents colorScheme={scheme} seedColor={SEED_COLOR}>
        <Menu
          modifiers={[accessibilityLabel(APPEARANCE_COPY.title)]}
          label={
            <RNHostView matchContents>
              <View style={styles.target}>
                <Icon name="appearance" size={22} color={colors.foreground} />
              </View>
            </RNHostView>
          }
        >
          <AppearancePicker style="inline" />
        </Menu>
      </Host>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  target: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
