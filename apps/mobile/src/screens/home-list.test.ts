import { describe, expect, it } from '@jest/globals';
import type { HistoryEntry } from '../history/history';
import {
  formatLastJoined,
  pinActionLabel,
  removeActionLabel,
  rowDetail,
  rowHost,
  rowSubtitle,
  sectionHistory,
} from './home-list';

const NOW = Date.UTC(2026, 8, 7);

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  host: 'a.example',
  pin: '834912',
  name: 'Sunday service',
  lastJoinedAt: NOW,
  pinned: false,
  unavailable: false,
  ...overrides,
});

describe('sectionHistory', () => {
  it('puts every pinned row above every recent one, whatever the dates', () => {
    const rows = [
      entry({ host: 'r1.example', lastJoinedAt: 900 }),
      entry({ host: 'p1.example', lastJoinedAt: 100, pinned: true }),
      entry({ host: 'r2.example', lastJoinedAt: 800 }),
      entry({ host: 'p2.example', lastJoinedAt: 50, pinned: true }),
      entry({ host: 'r3.example', lastJoinedAt: 700 }),
    ];

    const { pinned, recent } = sectionHistory(rows);

    expect(pinned.map((row) => row.host)).toEqual(['p1.example', 'p2.example']);
    expect(recent.map((row) => row.host)).toEqual(['r1.example', 'r2.example', 'r3.example']);
  });

  it('keeps an unavailable row in its section and its position', () => {
    const rows = [
      entry({ host: 'a.example', lastJoinedAt: 200 }),
      entry({ host: 'b.example', lastJoinedAt: 100, unavailable: true }),
    ];

    expect(sectionHistory(rows).recent.map((row) => row.host)).toEqual(['a.example', 'b.example']);
  });

  it('yields two empty sections for an empty store', () => {
    expect(sectionHistory([])).toEqual({ pinned: [], recent: [] });
  });
});

describe('formatLastJoined', () => {
  it('omits the year inside the current one', () => {
    expect(formatLastJoined(Date.UTC(2026, 7, 31, 12), NOW)).toBe('31 August');
  });

  it('names the year for an earlier one', () => {
    expect(formatLastJoined(Date.UTC(2025, 5, 11, 12), NOW)).toBe('11 June 2025');
  });

  it('yields nothing rather than throwing on an unusable date', () => {
    expect(formatLastJoined(Number.NaN, NOW)).toBe('');
  });
});

describe('row lines', () => {
  const row = entry({ host: 'stpauls.hallspeak.app', lastJoinedAt: Date.UTC(2026, 7, 31, 12) });

  it('gives the host its own line, with no scheme', () => {
    expect(rowHost(row)).toBe('stpauls.hallspeak.app');
    expect(rowHost(row)).not.toContain('://');
  });

  it('states when the guest was last here', () => {
    expect(rowDetail(row, NOW)).toBe('Last joined 31 August');
  });

  it('reads as one line for a screen reader', () => {
    expect(rowSubtitle(row, NOW)).toBe('stpauls.hallspeak.app · Last joined 31 August');
  });
});

describe('accessibility action labels', () => {
  it('names the event rather than the row position', () => {
    expect(pinActionLabel(entry())).toBe('Pin Sunday service');
    expect(pinActionLabel(entry({ pinned: true }))).toBe('Unpin Sunday service');
    expect(removeActionLabel(entry())).toBe('Remove Sunday service');
  });
});
