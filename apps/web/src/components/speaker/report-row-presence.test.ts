import type { ReportRow } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import { reconcileReportRows, removeLeavingReportRows } from './report-row-presence';

const row = (category: ReportRow['category'], count = 1): ReportRow => ({
  category,
  count,
  ageMs: 0,
});

describe('report row presence', () => {
  it('marks new categories for entrance in incoming order', () => {
    expect(reconcileReportRows([], [row('silent'), row('quiet')])).toEqual([
      { row: row('silent'), phase: 'entering' },
      { row: row('quiet'), phase: 'entering' },
    ]);
  });

  it('retains a removed category at its previous position until exit finishes', () => {
    const current = reconcileReportRows([], [row('silent'), row('quiet')]);
    const leaving = reconcileReportRows(current, [row('quiet')]);

    expect(leaving).toEqual([
      { row: row('silent'), phase: 'leaving' },
      { row: row('quiet'), phase: 'entering' },
    ]);
    expect(removeLeavingReportRows(leaving)).toEqual([{ row: row('quiet'), phase: 'entering' }]);
  });

  it('cancels exit when a category returns before removal', () => {
    const current = reconcileReportRows([], [row('noise')]);
    const leaving = reconcileReportRows(current, []);

    expect(reconcileReportRows(leaving, [row('noise', 2)])).toEqual([
      { row: row('noise', 2), phase: 'entering' },
    ]);
  });

  it('reuses unchanged state', () => {
    const current = reconcileReportRows([], [row('quiet')]);

    expect(reconcileReportRows(current, [row('quiet')])).toBe(current);
  });
});
