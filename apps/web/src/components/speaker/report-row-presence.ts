import type { ReportRow } from '@linguacast/contract/socket';

export interface PresentReportRow {
  row: ReportRow;
  phase: 'entering' | 'leaving';
}

/**
 * Reconciles keyed report rows while retaining removed categories for their exit animation.
 * Incoming order remains authoritative; a leaving row holds its previous position until gone.
 */
export function reconcileReportRows(
  current: PresentReportRow[],
  incoming: ReportRow[],
): PresentReportRow[] {
  const incomingKeys = new Set(incoming.map((row) => row.category));
  const next: PresentReportRow[] = incoming.map((row) => ({
    row,
    phase: 'entering',
  }));

  current.forEach((item, index) => {
    if (!incomingKeys.has(item.row.category)) {
      next.splice(Math.min(index, next.length), 0, { ...item, phase: 'leaving' });
    }
  });

  return sameRows(current, next) ? current : next;
}

export function removeLeavingReportRows(rows: PresentReportRow[]): PresentReportRow[] {
  return rows.filter((row) => row.phase !== 'leaving');
}

function sameRows(left: PresentReportRow[], right: PresentReportRow[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.phase === right[index]?.phase &&
        item.row.category === right[index]?.row.category &&
        item.row.count === right[index]?.row.count &&
        item.row.ageMs === right[index]?.row.ageMs,
    )
  );
}
