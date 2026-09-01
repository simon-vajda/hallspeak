import { describe, expect, it } from 'vitest';
import { REPORT_DISABLE_MS, reportRows, selfCheck } from './report-state';

const NOW = 1_000_000;

const rows = (over: Partial<Parameters<typeof reportRows>[0]> = {}) =>
  reportRows({ sent: {}, pending: null, failed: null, live: true, now: NOW, ...over });

describe('reportRows', () => {
  it('disables every category and claims nothing was sent when nobody is broadcasting', () => {
    const list = rows({ live: false });

    expect(list.every((entry) => entry.disabled)).toBe(true);
    expect(list.every((entry) => entry.note === '')).toBe(true);
  });

  it('disables only the category sent inside the window and says how long ago', () => {
    const list = rows({ sent: { quiet: NOW - 30_000 } });

    expect(list.find((entry) => entry.key === 'quiet')).toMatchObject({
      disabled: true,
      note: 'Sent 30s ago',
    });
    expect(list.filter((entry) => entry.disabled)).toHaveLength(1);
  });

  it('re-enables a category once the window has passed, with no note', () => {
    const list = rows({ sent: { quiet: NOW - REPORT_DISABLE_MS - 1_000 } });

    expect(list.find((entry) => entry.key === 'quiet')).toMatchObject({
      disabled: false,
      note: '',
    });
  });

  it('marks the pending row and makes every other category inert', () => {
    const list = rows({ pending: 'noise' });

    expect(list.find((entry) => entry.key === 'noise')?.note).toBe('Sending…');
    expect(list.every((entry) => entry.disabled)).toBe(true);
  });

  it('prints a refusal on its own row and leaves that category enabled', () => {
    const list = rows({ failed: { category: 'loud', message: 'Nobody is broadcasting.' } });

    expect(list.find((entry) => entry.key === 'loud')).toMatchObject({
      disabled: false,
      note: 'Nobody is broadcasting.',
    });
  });

  it('names all five categories', () => {
    expect(rows().map((entry) => entry.key)).toEqual([
      'quiet',
      'loud',
      'static',
      'noise',
      'silent',
    ]);
  });
});

describe('selfCheck', () => {
  it('flags a volume below 40 and not at 40', () => {
    expect(selfCheck({ volume: 39, muted: false, live: true })).toMatchObject({
      volumeLabel: '39%',
      volumeWarn: true,
    });
    expect(selfCheck({ volume: 40, muted: false, live: true }).volumeWarn).toBe(false);
  });

  it('flags a muted interpreter and not an unmuted one', () => {
    expect(selfCheck({ volume: 80, muted: true, live: true })).toMatchObject({
      interpreterLabel: 'Muted',
      interpreterWarn: true,
    });
    expect(selfCheck({ volume: 80, muted: false, live: true })).toMatchObject({
      interpreterLabel: 'Not muted',
      interpreterWarn: false,
    });
  });

  it('reads an unknown mute state as an em dash, never as Not muted', () => {
    const check = selfCheck({ volume: 80, muted: null, live: true });

    expect(check.interpreterLabel).toBe('—');
    expect(check.interpreterKnown).toBe(false);
    expect(check.interpreterWarn).toBe(false);
  });

  it('says nobody is broadcasting rather than reporting a mute state', () => {
    expect(selfCheck({ volume: 80, muted: null, live: false })).toMatchObject({
      interpreterLabel: 'Not broadcasting',
      interpreterKnown: true,
      interpreterWarn: true,
    });
  });
});
