import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockStore.delete(key);
    },
  },
}));

import {
  DEFAULT_REMEMBERED_EVENT,
  forgetEvent,
  markEventUnavailable,
  parseStoredEvents,
  REMEMBERED_EVENTS_STORAGE_KEY,
  readRememberedEvents,
  rememberSuccessfulOpen,
  setEventPinned,
  sortRememberedEvents,
} from '../src/venues/storage';
import type { RememberedEvent } from '../src/venues/types';

function seed(records: unknown) {
  mockStore.set(REMEMBERED_EVENTS_STORAGE_KEY, JSON.stringify(records));
}

function record(overrides: Partial<RememberedEvent> = {}): RememberedEvent {
  return { ...DEFAULT_REMEMBERED_EVENT, host: 'a.example', pin: '111111', ...overrides };
}

beforeEach(() => {
  mockStore.clear();
});

describe('parseStoredEvents', () => {
  it('yields an empty list for a corrupt, non-JSON value', () => {
    expect(parseStoredEvents('{not json')).toEqual([]);
    expect(parseStoredEvents(null)).toEqual([]);
    expect(parseStoredEvents('{"host":"a.example"}')).toEqual([]);
  });

  it('defaults a record missing its pinned field rather than throwing', () => {
    const [parsed] = parseStoredEvents(
      JSON.stringify([{ host: 'a.example', pin: '111111', name: 'Sunday', lastConnectedAt: 5 }]),
    );
    expect(parsed).toEqual({
      host: 'a.example',
      pin: '111111',
      name: 'Sunday',
      lastConnectedAt: 5,
      pinned: false,
      unavailable: false,
    });
  });

  it('drops an entry with no usable host or PIN and keeps the rest', () => {
    const parsed = parseStoredEvents(
      JSON.stringify([{ host: '', pin: '111111' }, 42, { host: 'b.example', pin: '222222' }]),
    );
    expect(parsed.map((entry) => entry.host)).toEqual(['b.example']);
  });
});

describe('sortRememberedEvents', () => {
  it('places pinned entries above unpinned ones regardless of last connected time', () => {
    const sorted = sortRememberedEvents([
      record({ host: 'recent.example', lastConnectedAt: 900, pinned: false }),
      record({ host: 'pinned.example', lastConnectedAt: 1, pinned: true }),
      record({ host: 'old.example', lastConnectedAt: 100, pinned: false }),
      record({ host: 'never.example', lastConnectedAt: null, pinned: false }),
    ]);
    expect(sorted.map((entry) => entry.host)).toEqual([
      'pinned.example',
      'recent.example',
      'old.example',
      'never.example',
    ]);
  });
});

describe('remembered events storage', () => {
  it('stores two records with the same PIN on different hosts as two entries', async () => {
    await rememberSuccessfulOpen({ host: 'a.example', pin: '482100', name: 'A' }, 10);
    await rememberSuccessfulOpen({ host: 'b.example', pin: '482100', name: 'B' }, 20);

    const stored = await readRememberedEvents();
    expect(stored).toHaveLength(2);
    expect(stored.map((entry) => entry.host).sort()).toEqual(['a.example', 'b.example']);
  });

  it('round-trips a host carrying a non-default port unchanged', async () => {
    await rememberSuccessfulOpen({ host: 'host.example:8443', pin: '834912', name: 'Port' }, 1);
    const [stored] = await readRememberedEvents();
    expect(stored?.host).toBe('host.example:8443');
  });

  it('marks a record unavailable while preserving every other field', async () => {
    await rememberSuccessfulOpen({ host: 'a.example', pin: '111111', name: 'Sunday' }, 500);
    await setEventPinned('a.example', '111111', true);
    await markEventUnavailable('a.example', '111111');

    expect(await readRememberedEvents()).toEqual([
      {
        host: 'a.example',
        pin: '111111',
        name: 'Sunday',
        lastConnectedAt: 500,
        pinned: true,
        unavailable: true,
      },
    ]);
  });

  it('clears the unavailable mark on the next successful open', async () => {
    await rememberSuccessfulOpen({ host: 'a.example', pin: '111111', name: 'Sunday' }, 500);
    await markEventUnavailable('a.example', '111111');
    await rememberSuccessfulOpen({ host: 'a.example', pin: '111111', name: 'Sunday Renamed' }, 900);

    expect(await readRememberedEvents()).toEqual([
      {
        host: 'a.example',
        pin: '111111',
        name: 'Sunday Renamed',
        lastConnectedAt: 900,
        pinned: false,
        unavailable: false,
      },
    ]);
  });

  it('does not create a record when marking an unknown venue unavailable', async () => {
    await markEventUnavailable('ghost.example', '999999');
    expect(await readRememberedEvents()).toEqual([]);
  });

  it('reads an empty list from a corrupt stored value rather than crashing', async () => {
    mockStore.set(REMEMBERED_EVENTS_STORAGE_KEY, 'not json at all');
    await expect(readRememberedEvents()).resolves.toEqual([]);
  });

  it('removes a single venue and leaves the others', async () => {
    seed([
      { host: 'a.example', pin: '111111', name: 'A', lastConnectedAt: 1, pinned: false },
      { host: 'b.example', pin: '222222', name: 'B', lastConnectedAt: 2, pinned: false },
    ]);
    await forgetEvent('a.example', '111111');
    expect((await readRememberedEvents()).map((entry) => entry.host)).toEqual(['b.example']);
  });
});
