import type { ReportCategory } from '@linguacast/contract/socket';

/**
 * Copied from `apps/web/src/lib/reports.ts` rather than extracted: a shared package shaped
 * for one consumer is the usual result of guessing the seam early. The import above is
 * type-only and therefore erased, so nothing pulls the socket contract into this bundle.
 *
 * The web module's anchoring and sorting halves are deliberately absent. They exist for the
 * speaker's studio, which this app does not have, and copying them would be dead code.
 */
export type { ReportCategory };

/** The order the listener sheet lists them in, and the labels the web app uses. */
export const REPORT_CATEGORIES: { key: ReportCategory; label: string }[] = [
  { key: 'quiet', label: 'Too quiet' },
  { key: 'loud', label: 'Too loud, or distorted' },
  { key: 'static', label: 'Static or crackling' },
  { key: 'noise', label: 'Background noise' },
  { key: 'silent', label: 'No audio at all' },
];

export function reportLabel(category: ReportCategory): string {
  return REPORT_CATEGORIES.find((entry) => entry.key === category)?.label ?? category;
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
