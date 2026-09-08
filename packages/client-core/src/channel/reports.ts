import type { ReportCategory, ReportResolution, ReportRow } from '@linguacast/contract/socket';

/** Re-exported so a consumer takes the whole report vocabulary from one place. */
export type { ReportCategory };

export type ReportTone = 'warn' | 'severe';

/** A row anchored to this client's clock at receipt. */
export interface AnchoredRow {
  category: ReportCategory;
  count: number;
  receivedAt: number;
}

export interface AnchoredResolution {
  count: number;
  receivedAt: number;
}

/**
 * The wire carries `ageMs` rather than a timestamp, so each row is anchored the moment it
 * arrives. Anchoring at receipt rather than at render is what keeps a row's age honest: a
 * later re-anchor would reset every row to "just now", and an absolute server timestamp
 * would be read against a client clock that can be minutes off.
 */
export function anchorRows(rows: ReportRow[], now: number): AnchoredRow[] {
  return rows.map((row) => ({
    category: row.category,
    count: row.count,
    receivedAt: now - row.ageMs,
  }));
}

export function anchorResolution(
  resolution: ReportResolution,
  now: number,
): AnchoredResolution | null {
  return resolution === null
    ? null
    : { count: resolution.count, receivedAt: now - resolution.ageMs };
}

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
