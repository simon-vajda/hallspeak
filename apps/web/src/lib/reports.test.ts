import type { ReportRow } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import { reportAgeLabel, reportLabel, reportTone, sortReportRows } from './reports';

const row = (category: ReportRow['category'], ageMs: number): ReportRow => ({
  category,
  count: 1,
  ageMs,
});

describe('reportTone', () => {
  it('calls the two unusable categories severe and the rest warn', () => {
    expect(reportTone('loud')).toBe('severe');
    expect(reportTone('silent')).toBe('severe');
    expect(reportTone('quiet')).toBe('warn');
    expect(reportTone('static')).toBe('warn');
    expect(reportTone('noise')).toBe('warn');
  });
});

describe('sortReportRows', () => {
  it('puts a severe row above a warn row that is more recent', () => {
    const sorted = sortReportRows([row('quiet', 1_000), row('silent', 200_000)]);

    expect(sorted.map((entry) => entry.category)).toEqual(['silent', 'quiet']);
  });

  it('sorts two rows of the same tone most-recent-first', () => {
    const sorted = sortReportRows([row('noise', 90_000), row('static', 4_000)]);

    expect(sorted.map((entry) => entry.category)).toEqual(['static', 'noise']);
  });

  it('leaves the caller’s array alone', () => {
    const rows = [row('quiet', 1_000), row('silent', 200_000)];

    sortReportRows(rows);

    expect(rows.map((entry) => entry.category)).toEqual(['quiet', 'silent']);
  });
});

describe('reportAgeLabel', () => {
  it('reads as a moment under ten seconds, then in seconds, then in minutes', () => {
    expect(reportAgeLabel(9_000)).toBe('just now');
    expect(reportAgeLabel(10_000)).toBe('10s ago');
    expect(reportAgeLabel(59_999)).toBe('59s ago');
    expect(reportAgeLabel(60_000)).toBe('1m ago');
  });

  it('treats a negative age as the present rather than counting backwards', () => {
    expect(reportAgeLabel(-5_000)).toBe('just now');
  });
});

describe('reportLabel', () => {
  it('names every category', () => {
    expect(reportLabel('quiet')).toBe('Too quiet');
    expect(reportLabel('silent')).toBe('No audio at all');
  });
});
