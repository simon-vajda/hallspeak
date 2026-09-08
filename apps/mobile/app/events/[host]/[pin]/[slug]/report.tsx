import { type ReportCategory, reportLabel } from '@linguacast/client-core/channel';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { Icon } from '@/components/icon';
import { SheetChrome } from '@/components/sheet-chrome';
import { SheetCard, SheetCardRow, SheetOption, SheetOptions } from '@/components/sheet-list';
import { readChannelParams } from '@/links/route';
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
  RESOLUTION_LABEL,
  RESOLVED_CONFIRMATION_BODY,
  reportRows,
  reportSheetTitle,
  resolveRefusal,
  SENT_CONFIRMATION_BODY,
  type SendState,
  STILL_A_PROBLEM_TITLE,
  selfCheck,
  WHAT_IS_WRONG_TITLE,
  YOUR_VOLUME_LABEL,
} from '@/screens/report-rows';
import { useEventSocket } from '@/socket/provider';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export default function ReportSheet() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ host: string; pin: string; slug: string }>();
  const slug = readChannelParams(params.host, params.pin, params.slug)?.slug ?? '';
  const { channelStatuses, audio, reports } = useEventSocket();
  const [send, setSend] = useState<SendState>(IDLE_SEND);

  const status = channelStatuses[slug];
  // The interpreter's mute is genuinely unknown until the socket reports it, and is never
  // rendered as unmuted; the level is the phone's own, which is the only one there now is.
  const check = selfCheck({
    volume: audio.volume,
    muted: status?.muted ?? null,
    live: status?.online ?? false,
  });
  const open = hasOpenReport(send, reports.open);

  const rows = reportRows({
    sent: reports.sent,
    pending: pendingCategory(send),
    // The server's own reason, carried onto the row that was pressed.
    failed: send.kind === 'refused' ? { category: send.category, message: send.message } : null,
    live: status?.online ?? false,
    now: Date.now(),
  });

  const submit = (category: ReportCategory) => {
    setSend({ kind: 'sending', category });
    void reports.send(slug, category).then((outcome) => {
      setSend(
        outcome.ok
          ? { kind: 'sent', category, at: Date.now() }
          : { kind: 'refused', category, message: outcome.message },
      );
    });
  };

  const resolve = () => {
    setSend({ kind: 'resolving' });
    void reports.resolve(slug).then((outcome) => {
      setSend(
        outcome.ok ? { kind: 'resolved' } : { kind: 'resolve-refused', message: outcome.message },
      );
    });
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
              {...(resolveRefusal(send) === null ? {} : { note: resolveRefusal(send) ?? '' })}
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
    borderRadius: spacing.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
