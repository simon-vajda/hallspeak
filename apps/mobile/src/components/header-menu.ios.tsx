import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SHARE_COPY } from '@/screens/share-copy';
import { SEED_COLOR, useTheme } from '@/theme/provider';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';

const DISC = 38;

/**
 * The iOS half of the header's overflow menu: a SwiftUI `Menu` whose label is the same glass
 * disc as the back control, so the two sides of the header read as a pair. `header-menu.tsx`
 * is the Compose half; both take the same props.
 */
export function HeaderMenu({ shareHref }: { shareHref?: Href }) {
  const router = useRouter();
  const { scheme, colors } = useTheme();

  return (
    <GlassSurface interactive raised style={styles.disc}>
      <Host matchContents colorScheme={scheme} seedColor={SEED_COLOR}>
        <Menu
          modifiers={[accessibilityLabel(SHARE_COPY.menuLabel)]}
          label={
            <RNHostView matchContents>
              <View style={styles.target}>
                <Icon name="more" size={20} color={colors.foreground} strokeWidth={2.4} />
              </View>
            </RNHostView>
          }
        >
          {shareHref ? (
            <Button
              label={SHARE_COPY.menuShare}
              systemImage="qrcode"
              onPress={() => router.push(shareHref)}
            />
          ) : null}
          <Button
            label={SHARE_COPY.menuAppearance}
            systemImage="circle.lefthalf.filled"
            onPress={() => router.push('/appearance')}
          />
        </Menu>
      </Host>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2 },
  target: { width: DISC, height: DISC, alignItems: 'center', justifyContent: 'center' },
});
