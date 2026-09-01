import type { ReportCategory } from '@linguacast/contract/socket';
import { REPORT_CATEGORIES, reportAgeLabel } from '@/lib/reports';

/** The same two minutes the server enforces, so the two never disagree visibly. */
export const REPORT_DISABLE_MS = 2 * 60 * 1000;

/** Below this the listener's own volume is the likelier cause than the broadcast. */
export const LOW_VOLUME = 40;

export type SentMap = Partial<Record<ReportCategory, number>>;

export interface ReportRowState {
  key: ReportCategory;
  label: string;
  disabled: boolean;
  /** The right-hand label: what was sent and when, or what is happening to it now. */
  note: string;
}

export interface ReportListInput {
  sent: SentMap;
  /** The category whose send is outstanding; every row is inert while one is. */
  pending: ReportCategory | null;
  /** The reason the last send was refused, on the row it was refused for. */
  failed: { category: ReportCategory; message: string } | null;
  live: boolean;
  now: number;
}

export function reportRows({
  sent,
  pending,
  failed,
  live,
  now,
}: ReportListInput): ReportRowState[] {
  return REPORT_CATEGORIES.map(({ key, label }) => {
    const at = sent[key];
    const recent = at !== undefined && now - at < REPORT_DISABLE_MS;
    return {
      key,
      label,
      // Not live means there is nobody to tell; a send in flight means one at a time.
      disabled: !live || recent || pending !== null,
      note: rowNote({ key, pending, failed, recent, at, now }),
    };
  });
}

function rowNote({
  key,
  pending,
  failed,
  recent,
  at,
  now,
}: {
  key: ReportCategory;
  pending: ReportCategory | null;
  failed: ReportListInput['failed'];
  recent: boolean;
  at: number | undefined;
  now: number;
}): string {
  if (pending === key) {
    return 'Sending…';
  }
  if (failed?.category === key) {
    return failed.message;
  }
  if (recent && at !== undefined) {
    return `Sent ${reportAgeLabel(now - at)}`;
  }
  return '';
}

export interface SelfCheck {
  volumeLabel: string;
  volumeWarn: boolean;
  interpreterLabel: string;
  /** Null when the mute state is unknown; the label is an em dash and never `Not muted`. */
  interpreterKnown: boolean;
  interpreterWarn: boolean;
}

/**
 * The two things a listener can check themselves, stated before the categories. A muted
 * state that is not yet known reads as an em dash: told the interpreter is unmuted, a
 * listener will report `silent` on the strength of it.
 */
export function selfCheck({
  volume,
  muted,
  live,
}: {
  volume: number;
  muted: boolean | null;
  live: boolean;
}): SelfCheck {
  const volumeLabel = `${Math.round(volume)}%`;
  const volumeWarn = volume < LOW_VOLUME;

  // Nobody broadcasting outranks any mute state: there is no interpreter to be muted.
  if (!live) {
    return {
      volumeLabel,
      volumeWarn,
      interpreterLabel: 'Not broadcasting',
      interpreterKnown: true,
      interpreterWarn: true,
    };
  }

  return {
    volumeLabel,
    volumeWarn,
    interpreterLabel: muted === null ? '—' : muted ? 'Muted' : 'Not muted',
    interpreterKnown: muted !== null,
    interpreterWarn: muted === true,
  };
}
