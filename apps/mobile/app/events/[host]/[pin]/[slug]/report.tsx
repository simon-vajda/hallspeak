import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { SheetChrome } from '@/components/sheet-chrome';
import type { SentMap } from '@/lib/report-state';
import type { ReportCategory } from '@/lib/reports';
import { DEFAULT_VOLUME } from '@/screens/audio-sheet';
import {
  CHECK_FIRST_TITLE,
  IDLE_SEND,
  INTERPRETER_LABEL,
  pendingCategory,
  REPORT_FOOTER,
  REPORT_SHEET_TITLE,
  REPORT_UNAVAILABLE_NOTE,
  RESOLUTION_LABEL,
  reportRows,
  type SendState,
  selfCheck,
  WHAT_IS_WRONG_TITLE,
  YOUR_VOLUME_LABEL,
} from '@/screens/report-rows';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function ReportSheet() {
  const colors = useColors();
  const router = useRouter();
  const [sent, setSent] = useState<SentMap>({});
  const [send, setSend] = useState<SendState>(IDLE_SEND);
  const [resolved, setResolved] = useState(false);

  // Placeholder readings: the guest's own volume and the interpreter's mute state both need
  // a mechanism this run does not build, and the interpreter's is deliberately unknown
  // rather than reported as unmuted.
  const check = selfCheck({ volume: DEFAULT_VOLUME, muted: null, live: true });

  const rows = reportRows({
    sent,
    pending: pendingCategory(send),
    failed: null,
    live: true,
    now: Date.now(),
  });

  const submit = (category: ReportCategory) => {
    setSend({ kind: 'sending', category });
    setResolved(false);

    // The send has no transport in this run; the timeout is what exercises the sheet's own
    // list → sending → sent transitions.
    setTimeout(() => {
      const at = Date.now();
      setSent((previous) => ({ ...previous, [category]: at }));
      setSend({ kind: 'sent', category, at });
    }, 400);
  };

  return (
    <SheetChrome title={REPORT_SHEET_TITLE} onDone={() => router.back()}>
      <View style={styles.section}>
        <Text style={[type.label, { color: colors.mutedForeground }]}>
          {CHECK_FIRST_TITLE.toUpperCase()}
        </Text>
        <View style={[styles.group, { borderColor: colors.border }]}>
          <CheckRow label={YOUR_VOLUME_LABEL} value={check.volumeLabel} warn={check.volumeWarn} />
          <CheckRow
            label={INTERPRETER_LABEL}
            value={check.interpreterLabel}
            warn={check.interpreterWarn}
            divided
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[type.label, { color: colors.mutedForeground }]}>
          {WHAT_IS_WRONG_TITLE.toUpperCase()}
        </Text>
        <View style={styles.rows}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityState={{ disabled: row.disabled }}
              disabled={row.disabled}
              onPress={() => submit(row.key)}
              style={[
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: row.disabled ? 0.55 : 1,
                },
              ]}
            >
              <Text style={[type.body, styles.rowLabel, { color: colors.foreground }]}>
                {row.label}
              </Text>
              {row.note ? (
                <Text style={[type.meta, { color: colors.mutedForeground }]}>{row.note}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {/* Its own affordance in the live tokens, never a sixth category: it says this
          listener's problem is gone and claims nothing about anybody else's. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: resolved }}
        onPress={() => {
          setResolved(true);
          setSent({});
          setSend(IDLE_SEND);
        }}
        style={[
          styles.resolution,
          { backgroundColor: colors.liveMuted, borderColor: colors.liveMuted },
        ]}
      >
        <Icon name={resolved ? 'confirm' : 'volume'} size={18} color={colors.liveOnMuted} />
        <Text style={[type.body, styles.rowLabel, { color: colors.liveOnMuted }]}>
          {RESOLUTION_LABEL}
        </Text>
      </Pressable>

      <Text style={[type.meta, { color: colors.mutedForeground }]}>{REPORT_FOOTER}</Text>
      <Text style={[type.meta, { color: colors.mutedForeground }]}>{REPORT_UNAVAILABLE_NOTE}</Text>
    </SheetChrome>
  );
}

function CheckRow({
  label,
  value,
  warn,
  divided = false,
}: {
  label: string;
  value: string;
  warn: boolean;
  divided?: boolean;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.checkRow,
        divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      ]}
    >
      <Text style={[type.body, styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[type.body, { color: warn ? colors.warnOnMuted : colors.mutedForeground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touch,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: spacing.touch,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1 },
  resolution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: spacing.touch,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
