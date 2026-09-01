import type { ReportCategory, ReportRow } from '@linguacast/contract/socket';

export type ReportTone = 'warn' | 'severe';

/** The order the listener sheet lists them in; the studio sorts by severity and recency. */
export const REPORT_CATEGORIES: { key: ReportCategory; label: string }[] = [
  { key: 'quiet', label: 'Too quiet' },
  { key: 'loud', label: 'Too loud, or distorted' },
  { key: 'static', label: 'Static or crackling' },
  { key: 'noise', label: 'Background noise' },
  { key: 'silent', label: 'No audio at all' },
];

/** The two an interpreter has to act on first: the channel is unusable, not merely poor. */
const SEVERE: ReadonlySet<ReportCategory> = new Set<ReportCategory>(['loud', 'silent']);

export function reportLabel(category: ReportCategory): string {
  return REPORT_CATEGORIES.find((entry) => entry.key === category)?.label ?? category;
}

export function reportTone(category: ReportCategory): ReportTone {
  return SEVERE.has(category) ? 'severe' : 'warn';
}

/** Severe first, then whichever was reported most recently. */
export function sortReportRows(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const tone =
      Number(reportTone(b.category) === 'severe') - Number(reportTone(a.category) === 'severe');
    return tone !== 0 ? tone : a.ageMs - b.ageMs;
  });
}

/** Seconds while they read as a moment, minutes once they do not. */
export function reportAgeLabel(ageMs: number): string {
  const seconds = Math.floor(Math.max(ageMs, 0) / 1000);
  if (seconds < 10) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  return `${Math.floor(seconds / 60)}m ago`;
}
