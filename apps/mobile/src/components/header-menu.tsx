import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SHARE_COPY } from '@/screens/share-copy';
import { useColors, useSurfaces } from '@/theme/provider';
import { motion, radius, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import type { IconName } from './icons';
import { ripple } from './press';

const TARGET = 48;
const GAP = 4;
const ITEM = 48;

type Anchor = { top: number; right: number };
type Item = { label: string; icon: IconName; href: Href };

/**
 * The Android half of the header's overflow menu: Material's flat 48px target opening an
 * anchored popover drawn in React Native. `@expo/ui`'s Compose `DropdownMenu` exposes only a
 * container colour, so its 4dp corners and icon-less rows could not be brought up to the rest of
 * the app. `header-menu.ios.tsx` is the SwiftUI half; both take the same props.
 */
export function HeaderMenu({ shareHref }: { shareHref?: Href }) {
  const router = useRouter();
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const items: Item[] = [
    ...(shareHref
      ? [{ label: SHARE_COPY.menuShare, icon: 'share' as const, href: shareHref }]
      : []),
    { label: SHARE_COPY.menuAppearance, icon: 'appearance', href: '/appearance' },
  ];

  const open = () => {
    trigger.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + GAP, right: windowWidth - (x + width) });
    });
  };

  const choose = (href: Href) => {
    setAnchor(null);
    router.push(href);
  };

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={SHARE_COPY.menuLabel}
        accessibilityState={{ expanded: anchor !== null }}
        onPress={open}
        android_ripple={ripple(withAlpha(colors.foreground, 0.14), true)}
        style={styles.target}
      >
        <Icon name="moreVertical" size={22} color={colors.foreground} />
      </Pressable>

      <Modal
        transparent
        visible={anchor !== null}
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAnchor(null)}
      >
        <Pressable
          accessibilityLabel="Close menu"
          style={StyleSheet.absoluteFill}
          onPress={() => setAnchor(null)}
        />
        {anchor ? <Popover anchor={anchor} items={items} onChoose={choose} /> : null}
      </Modal>
    </>
  );
}

function Popover({
  anchor,
  items,
  onChoose,
}: {
  anchor: Anchor;
  items: Item[];
  onChoose: (href: Href) => void;
}) {
  const colors = useColors();
  const surfaces = useSurfaces();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : motion.pressMs });
  }, [progress, reduceMotion]);

  const entrance = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + 0.08 * progress.value }],
  }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        accessibilityRole="menu"
        style={[
          styles.menu,
          { top: anchor.top, right: anchor.right, backgroundColor: surfaces.high },
          entrance,
        ]}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="menuitem"
            onPress={() => onChoose(item.href)}
            android_ripple={ripple(withAlpha(colors.foreground, 0.12))}
            style={styles.item}
          >
            <Icon name={item.icon} size={20} color={colors.foreground} />
            <Text style={[type.body, { color: colors.foreground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  target: {
    width: TARGET,
    height: TARGET,
    borderRadius: TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    minWidth: 200,
    padding: 6,
    gap: 2,
    borderRadius: radius.md,
    elevation: 3,
    // Material aligns an overflow menu to its trigger's trailing edge; scaling in from that
    // corner makes it grow out of the button that opened it.
    transformOrigin: 'top right',
  },
  item: {
    minHeight: ITEM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
