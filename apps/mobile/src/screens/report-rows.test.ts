import { describe, expect, it } from '@jest/globals';
import { REPORT_CATEGORIES } from '@linguacast/client-core/channel';
import {
  ALL_REPORT_SHEET_COPY,
  hasOpenReport,
  IDLE_SEND,
  isBusy,
  LOW_VOLUME,
  REPORT_DISABLE_MS,
  RESOLUTION_LABEL,
  reportRows,
  reportSheetTitle,
  STILL_A_PROBLEM_TITLE,
  selfCheck,
  WHAT_IS_WRONG_TITLE,
} from './report-rows';

const rows = (overrides: Parameters<typeof reportRows>[0]) => reportRows(overrides);

describe('the five categories', () => {
  it("keeps the web app's order and labels", () => {
    expect(REPORT_CATEGORIES.map((entry) => entry.label)).toEqual([
      'Too quiet',
      'Too loud, or distorted',
      'Static or crackling',
      'Background noise',
      'No audio at all',
    ]);
  });

  it('does not count the positive signal among them', () => {
    expect(REPORT_CATEGORIES.map((entry) => entry.label)).not.toContain(RESOLUTION_LABEL);
    expect(REPORT_CATEGORIES).toHaveLength(5);
  });
});

describe('cooldown', () => {
  const now = 10 * 60 * 1000;

  it('disables a category inside its cooldown and labels its age', () => {
    const [quiet] = rows({
      sent: { quiet: now - 40_000 },
      pending: null,
      failed: null,
      live: true,
      now,
    });

    expect(quiet?.disabled).toBe(true);
    expect(quiet?.note).toBe('Sent 40s ago');
  });

  it('formats a few minutes differently from a few seconds', () => {
    const [quiet] = rows({
      // Inside the two-minute cooldown, or the note would be empty rather than aged.
      sent: { quiet: now - 90_000 },
      pending: null,
      failed: null,
      live: true,
      now,
    });

    expect(quiet?.note).toBe('Sent 1m ago');
  });

  it('enables the same category once the cooldown passes', () => {
    const [quiet] = rows({
      sent: { quiet: now - REPORT_DISABLE_MS - 1 },
      pending: null,
      failed: null,
      live: true,
      now,
    });

    expect(quiet?.disabled).toBe(false);
    expect(quiet?.note).toBe('');
  });
});

describe('check first', () => {
  it('tints warn below the low-volume threshold and not above it', () => {
    expect(selfCheck({ volume: LOW_VOLUME - 1, muted: false, live: true }).volumeWarn).toBe(true);
    expect(selfCheck({ volume: LOW_VOLUME + 1, muted: false, live: true }).volumeWarn).toBe(false);
  });

  it('shows an unknown interpreter as unknown rather than as not muted', () => {
    const unknown = selfCheck({ volume: 80, muted: null, live: true });

    expect(unknown.interpreterLabel).toBe('—');
    expect(unknown.interpreterKnown).toBe(false);
  });

  it('lets nobody-broadcasting outrank any mute state', () => {
    expect(selfCheck({ volume: 80, muted: null, live: false }).interpreterLabel).toBe(
      'Not broadcasting',
    );
  });
});

describe('report sheet copy', () => {
  it('never claims audio is playing', () => {
    for (const line of ALL_REPORT_SHEET_COPY) {
      const lower = line.toLowerCase();

      for (const claim of ['is playing', 'now playing', 'you are hearing', 'everyone can hear']) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });
});

describe('the positive signal', () => {
  it('appears only once this connection has an open report', () => {
    expect(hasOpenReport(IDLE_SEND, false)).toBe(false);
    expect(hasOpenReport(IDLE_SEND, true)).toBe(true);
  });

  it('is gone again once the guest says it is fixed', () => {
    expect(hasOpenReport({ kind: 'resolved' }, true)).toBe(false);
  });

  it('renames the sheet and the category heading while a report is open', () => {
    expect(reportSheetTitle(false)).toBe('Report a problem');
    expect(reportSheetTitle(true)).toBe('Update report');
    expect(STILL_A_PROBLEM_TITLE).not.toBe(WHAT_IS_WRONG_TITLE);
  });

  it('is not a sixth category', () => {
    expect(REPORT_CATEGORIES.map((entry) => entry.label)).not.toContain(RESOLUTION_LABEL);
  });
});

describe('isBusy', () => {
  it('holds every row inert while a send or a resolve is in flight', () => {
    expect(isBusy({ kind: 'sending', category: 'quiet' })).toBe(true);
    expect(isBusy({ kind: 'resolving' })).toBe(true);
    expect(isBusy(IDLE_SEND)).toBe(false);
    expect(isBusy({ kind: 'resolved' })).toBe(false);
  });
});
