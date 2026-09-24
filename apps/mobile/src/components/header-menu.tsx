import { DropdownMenu, DropdownMenuItem, Host, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SHARE_COPY } from '@/screens/share-copy';
import { SEED_COLOR, useTheme } from '@/theme/provider';
import { Icon } from './icon';

const TARGET = 48;

/**
 * The Android half of the header's overflow menu: Material's flat 48px target anchoring a
 * Compose `DropdownMenu`. Items are text-only because lucide glyphs are not registered as
 * Compose icons. `header-menu.ios.tsx` is the SwiftUI half; both take the same props.
 */
export function HeaderMenu({ shareHref }: { shareHref?: Href }) {
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const choose = (href: Href) => {
    setExpanded(false);
    router.push(href);
  };

  return (
    <Host matchContents colorScheme={scheme} seedColor={SEED_COLOR}>
      <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SHARE_COPY.menuLabel}
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(true)}
              style={({ pressed }) => [styles.target, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="moreVertical" size={22} color={colors.foreground} />
            </Pressable>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {shareHref ? (
            <DropdownMenuItem onClick={() => choose(shareHref)}>
              <DropdownMenuItem.Text>
                <Text>{SHARE_COPY.menuShare}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => choose('/appearance')}>
            <DropdownMenuItem.Text>
              <Text>{SHARE_COPY.menuAppearance}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  target: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
});
