import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { Icon } from '@/components/icon';
import { SheetChrome } from '@/components/sheet-chrome';
import { SheetCard, SheetCardRow, SheetOption, SheetOptions } from '@/components/sheet-list';
import type { SentMap } from '@/lib/report-state';
import type { ReportCategory } from '@/lib/reports';
import { reportLabel } from '@/lib/reports';
import { DEFAULT_VOLUME } from '@/screens/audio-sheet';
import {
  CHECK_FIRST_TITLE,
  DONE_LABEL,
  hasOpenReport,
  IDLE_SEND,
  INTERPRETER_LABEL,
  IS_IT_FIXED_TITLE,
  isBusy,
  pendingCategory,
  REPORT_FOOTER,
  REPORT_UNAVAILABLE_NOTE,
  RESOLUTION_LABEL,
  RESOLVED_CONFIRMATION_BODY,
  reportRows,
  reportSheetTitle,
  SENT_CONFIRMATION_BODY,
  type SendState,
  STILL_A_PROBLEM_TITLE,
  selfCheck,
  WHAT_IS_WRONG_TITLE,
  YOUR_VOLUME_LABEL,
} from '@/screens/report-rows';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

/** Long enough to see the transition, short enough not to feel like a hang. */
const STUB_SEND_MS = 400;

export default function ReportSheet() {
  const colors = useColors();
  const router = useRouter();
  const [sent, setSent] = useState<SentMap>({});
  const [send, setSend] = useState<SendState>(IDLE_SEND);

  // Placeholder readings: the guest's own volume and the interpreter's mute state both need
  // a mechanism this run does not build, and the interpreter's is deliberately unknown
  // rather than reported as unmuted.
  const check = selfCheck({ volume: DEFAULT_VOLUME, muted: null, live: true });
  const open = hasOpenReport(send, sent);

  const rows = reportRows({
    sent,
    pending: pendingCategory(send),
    failed: null,
    live: true,
    now: Date.now(),
  });

  // No transport in this run; the delay is what exercises the sheet's own transitions.
  const submit = (category: ReportCategory) => {
    setSend({ kind: 'sending', category });
    setTimeout(() => {
      const at = Date.now();
      setSent((previous) => ({ ...previous, [category]: at }));
      setSend({ kind: 'sent', category, at });
    }, STUB_SEND_MS);
  };

  const resolve = () => {
    setSend({ kind: 'resolving' });
    setTimeout(() => {
      setSent({});
      setSend({ kind: 'resolved' });
    }, STUB_SEND_MS);
  };

  if (send.kind === 'sent' || send.kind === 'resolved') {
    const isSend = send.kind === 'sent';

    return (
      <SheetChrome title="Sent" onDone={() => router.back()}>
        <View style={styles.confirmation}>
          <View style={[styles.tick, { backgroundColor: colors.liveMuted }]}>
            <Icon name="confirm" size={22} color={colors.liveOnMuted} strokeWidth={2.25} />
          </View>
          <Text style={[type.section, styles.centred, { color: colors.foreground }]}>
            {isSend ? `Sent — “${reportLabel(send.category)}”.` : `Sent — “${RESOLUTION_LABEL}”.`}
          </Text>
          <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>
            {isSend ? SENT_CONFIRMATION_BODY : RESOLVED_CONFIRMATION_BODY}
          </Text>
          <ActionButton
            label={DONE_LABEL}
            icon="confirm"
            variant="tonal"
            onPress={() => setSend(IDLE_SEND)}
          />
        </View>
      </SheetChrome>
    );
  }

  return (
    <SheetChrome title={reportSheetTitle(open)} onDone={() => router.back()}>
      <SheetCard label={CHECK_FIRST_TITLE}>
        <SheetCardRow
          label={YOUR_VOLUME_LABEL}
          value={check.volumeLabel}
          warn={check.volumeWarn}
          mono
        />
        <SheetCardRow
          label={INTERPRETER_LABEL}
          value={check.interpreterLabel}
          warn={check.interpreterWarn}
          divided
        />
      </SheetCard>

      {/* Above the categories, because a listener who came back came back to answer this. */}
      {open ? (
        <View style={styles.section}>
          <Text style={[type.label, { color: colors.mutedForeground }]}>
            {IS_IT_FIXED_TITLE.toUpperCase()}
          </Text>
          <SheetOptions>
            <SheetOption
              index={0}
              count={1}
              label={RESOLUTION_LABEL}
              disabled={isBusy(send)}
              tone={{ background: colors.liveMuted, foreground: colors.liveOnMuted }}
              leading={
                <Icon name="confirm" size={17} color={colors.liveOnMuted} strokeWidth={2.5} />
              }
              onPress={resolve}
            />
          </SheetOptions>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[type.label, { color: colors.mutedForeground }]}>
          {(open ? STILL_A_PROBLEM_TITLE : WHAT_IS_WRONG_TITLE).toUpperCase()}
        </Text>
        <SheetOptions>
          {rows.map((row, index) => (
            <SheetOption
              key={row.key}
              index={index}
              count={rows.length}
              label={row.label}
              note={row.note}
              disabled={row.disabled || isBusy(send)}
              onPress={() => submit(row.key)}
            />
          ))}
        </SheetOptions>
      </View>

      <Text style={[type.note, { color: colors.mutedForeground }]}>{REPORT_FOOTER}</Text>
      <Text style={[type.meta, { color: colors.mutedForeground }]}>{REPORT_UNAVAILABLE_NOTE}</Text>
    </SheetChrome>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  centred: { textAlign: 'center' },
  confirmation: { alignItems: 'center', gap: 12, paddingTop: 8 },
  tick: {
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
