import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { connectedListShape } from '@/theme/shape';
import { radius } from '@/theme/tokens';
import { type } from '@/theme/typography';

const ANDROID = Platform.OS === 'android';

const CARD_GAP = 11;

/**
 * The two shapes both sheets are built from, and the one place their platform split lives.
 * A choice is a pill on iOS and a segment of Material's connected list on Android — the
 * design draws exactly that, and the audio and report sheets would otherwise each carry
 * their own copy of it.
 */
export function SheetCard({ label, children }: { label: string; children: ReactNode }) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[type.label, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export function SheetCardRow({
  label,
  value,
  warn = false,
  tone,
  divided = false,
  mono = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
  tone?: string;
  divided?: boolean;
  mono?: boolean;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.cardRow,
        // Matching the card's own gap, so the rule sits midway between the two rows
        // rather than against the label under it.
        divided && {
          paddingTop: CARD_GAP,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Text style={[type.body, { color: colors.foreground }]}>{label}</Text>
      <Text
        style={[
          mono ? type.monoValue : type.bodyStrong,
          styles.value,
          { color: warn ? colors.warnOnMuted : (tone ?? colors.foreground) },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function SheetOptions({ children }: { children: ReactNode }) {
  return <View style={ANDROID ? styles.androidGroup : styles.iosGroup}>{children}</View>;
}

export function SheetOption({
  label,
  note,
  index,
  count,
  selected = false,
  disabled = false,
  tone,
  leading,
  trailing,
  onPress,
}: {
  label: string;
  note?: string;
  /** Position in the group, which is what gives Material's list its end shapes. */
  index: number;
  count: number;
  selected?: boolean;
  disabled?: boolean;
  /** Overrides the row's surface and ink — the positive signal takes the live tokens. */
  tone?: { background: string; foreground: string };
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
}) {
  const colors = useColors();
  const background = tone?.background ?? (selected ? colors.primaryMuted : colors.card);
  const foreground = tone?.foreground ?? colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        ANDROID
          ? connectedListShape(index, count)
          : [styles.iosOption, { borderColor: colors.border }],
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.92 : 1 },
      ]}
    >
      {leading}
      <Text style={[type.option, styles.grow, { color: foreground }]}>{label}</Text>
      {note ? (
        <Text style={[type.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 15, gap: CARD_GAP },
  cardRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingTop: 0 },
  value: { flex: 1, textAlign: 'right' },
  androidGroup: { gap: 3 },
  iosGroup: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: ANDROID ? 56 : 48,
    paddingHorizontal: ANDROID ? 20 : 18,
  },
  iosOption: { borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1 },
});
