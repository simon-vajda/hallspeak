import { describe, expect, it } from '@jest/globals';
import {
  type HistoryEntry,
  markUnavailable,
  parseHistory,
  remember,
  remove,
  restore,
  serializeHistory,
  setPinned,
} from './history';

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  host: 'a.example',
  pin: '834912',
  name: 'Sunday service',
  lastJoinedAt: 1_000,
  pinned: false,
  unavailable: false,
  ...overrides,
});

describe('remember', () => {
  it('appends a row for a host and PIN it has not seen', () => {
    const after = remember([], { host: 'a.example', pin: '834912', name: 'Sunday', at: 5 });

    expect(after).toHaveLength(1);
    expect(after[0]?.lastJoinedAt).toBe(5);
  });

  it('updates the date without duplicating', () => {
    const after = remember([entry()], {
      host: 'a.example',
      pin: '834912',
      name: 'Sunday service',
      at: 2_000,
    });

    expect(after).toHaveLength(1);
    expect(after[0]?.lastJoinedAt).toBe(2_000);
  });

  it('remembers no channel: a row opens the event, never a language', () => {
    const after = remember([], { host: 'a.example', pin: '834912', name: 'Sunday', at: 5 });

    expect(after[0]).not.toHaveProperty('lastSlug');
  });

  it('clears an earlier failure to reach the event', () => {
    const after = remember([entry({ unavailable: true })], {
      host: 'a.example',
      pin: '834912',
      name: 'Sunday service',
      at: 2_000,
    });

    expect(after[0]?.unavailable).toBe(false);
  });

  it('keeps two servers sharing a PIN independent', () => {
    const after = remember([entry()], { host: 'b.example', pin: '834912', name: 'Vespers', at: 9 });

    expect(after).toHaveLength(2);
  });
});

describe('markUnavailable', () => {
  it('sets the flag and touches nothing else', () => {
    const before = entry({ pinned: true });
    const after = markUnavailable([before], { host: 'a.example', pin: '834912' });

    expect(after[0]).toEqual({ ...before, unavailable: true });
  });

  it('invents nothing when no row matches', () => {
    expect(markUnavailable([entry()], { host: 'b.example', pin: '834912' })).toEqual([entry()]);
  });
});

describe('setPinned and remove', () => {
  it('pins without reordering', () => {
    const rows = [entry(), entry({ host: 'b.example' })];
    const after = setPinned(rows, { host: 'b.example', pin: '834912' }, true);

    expect(after.map((row) => row.host)).toEqual(['a.example', 'b.example']);
    expect(after[1]?.pinned).toBe(true);
  });

  it('removes only the matching row', () => {
    const rows = [entry(), entry({ host: 'b.example' })];

    expect(remove(rows, { host: 'a.example', pin: '834912' })).toEqual([
      entry({ host: 'b.example' }),
    ]);
  });
});

describe('parseHistory', () => {
  it('round-trips what it wrote', () => {
    const rows = [entry(), entry({ host: 'b.example', pinned: true })];

    expect(parseHistory(serializeHistory(rows))).toEqual(rows);
  });

  it('yields an empty list for anything it cannot read', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('{not json')).toEqual([]);
    expect(parseHistory('{"host":"a.example"}')).toEqual([]);
  });

  it('drops a row with no key and defaults the rest of a partial one', () => {
    const parsed = parseHistory(
      JSON.stringify([{ pin: '834912' }, { host: 'a.example', pin: '1' }]),
    );

    expect(parsed).toEqual([
      {
        host: 'a.example',
        pin: '1',
        name: '',
        lastJoinedAt: 0,
        pinned: false,
        unavailable: false,
      },
    ]);
  });
});

describe('restore', () => {
  it('puts a removed row back exactly as it was', () => {
    const removed = entry({ pinned: true, lastJoinedAt: 42 });

    expect(restore(remove([removed], removed), removed)).toEqual([removed]);
  });

  it('does not duplicate a row that is already there', () => {
    expect(restore([entry()], entry())).toEqual([entry()]);
  });
});
