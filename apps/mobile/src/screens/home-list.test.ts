import { describe, expect, it } from '@jest/globals';
import type { HistoryEntry } from '../history/history';
import {
  formatLastJoined,
  pinActionLabel,
  removeActionLabel,
  rowSubtitle,
  sectionHistory,
} from './home-list';

const NOW = Date.UTC(2026, 8, 7);

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  host: 'a.example',
  pin: '834912',
  name: 'Sunday service',
  lastSlug: null,
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

describe('rowSubtitle', () => {
  it('composes the bare host and the date', () => {
    const subtitle = rowSubtitle(
      entry({ host: 'stpauls.linguacast.app', lastJoinedAt: Date.UTC(2026, 7, 31, 12) }),
      NOW,
    );

    expect(subtitle).toBe('stpauls.linguacast.app · 31 August');
    expect(subtitle).not.toContain('://');
  });
});

describe('accessibility action labels', () => {
  it('names the event rather than the row position', () => {
    expect(pinActionLabel(entry())).toBe('Pin Sunday service');
    expect(pinActionLabel(entry({ pinned: true }))).toBe('Unpin Sunday service');
    expect(removeActionLabel(entry())).toBe('Remove Sunday service');
  });
});
