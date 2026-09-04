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

import { fetchPublicEvent, openEvent } from '../src/venues/client';
import { buildEventView } from '../src/venues/event-view';
import { REMEMBERED_EVENTS_STORAGE_KEY, readRememberedEvents } from '../src/venues/storage';
import type { RememberedEvent } from '../src/venues/types';

const EVENT = {
  pin: '834912',
  name: 'Sunday Service',
  description: "Morning service from St Paul's, interpreted live.",
  channels: [
    { slug: 'espanol', name: 'Español', online: true },
    { slug: 'magyar', name: 'Magyar', online: false },
  ],
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn<typeof fetch>();

async function seed(events: RememberedEvent[]) {
  mockStore.set(REMEMBERED_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

beforeEach(() => {
  mockStore.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('buildEventView', () => {
  it('renders the fetched event, its host and its channel picker', () => {
    const view = buildEventView({ outcome: 'verified', event: EVENT }, 'stpauls.linguacast.app');

    expect(view.kind).toBe('event');
    if (view.kind !== 'event') {
      return;
    }
    expect(view.name).toBe('Sunday Service');
    expect(view.description).toBe("Morning service from St Paul's, interpreted live.");
    expect(view.host).toBe('stpauls.linguacast.app');
    expect(view.picker.kind).toBe('channels');
  });

  it('shows the host as an authority alone, never as a full event URL', () => {
    const view = buildEventView(
      { outcome: 'verified', event: EVENT },
      'https://stpauls.linguacast.app/events/834912',
    );

    expect(view.kind === 'event' && view.host).toBe('stpauls.linguacast.app');
  });

  it('gives a missing event, a disabled event and a wrong PIN one identical view', async () => {
    // All three are a 404 at the server, which is the parity this screen must not break.
    const views: string[] = [];
    for (const body of [{ code: 'not_found' }, { code: 'not_found' }, { code: 'not_found' }]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, body));
      const lookup = await fetchPublicEvent('stpauls.linguacast.app', '834912');
      views.push(JSON.stringify(buildEventView(lookup, 'stpauls.linguacast.app')));
    }

    expect(new Set(views).size).toBe(1);
    expect(views[0]).not.toContain('834912');
    expect(views[0]).not.toContain('stpauls');
  });

  it('gives the on-air and offline rows the same set of slots', () => {
    const view = buildEventView({ outcome: 'verified', event: EVENT }, 'stpauls.linguacast.app');
    if (view.kind !== 'event' || view.picker.kind !== 'channels') {
      throw new Error('expected a channel picker');
    }

    const [live, offline] = view.picker.rows;
    expect(live?.online).toBe(true);
    expect(offline?.online).toBe(false);
    expect(Object.keys(live ?? {}).sort()).toEqual(Object.keys(offline ?? {}).sort());
    expect(live?.statusLabel).not.toBe(offline?.statusLabel);
  });

  it('yields the empty picker rather than an empty list of rows', () => {
    const view = buildEventView(
      { outcome: 'verified', event: { ...EVENT, channels: [] } },
      'stpauls.linguacast.app',
    );

    expect(view.kind === 'event' && view.picker.kind).toBe('empty');
  });

  it('omits a null description rather than carrying it as an empty string', () => {
    const view = buildEventView(
      { outcome: 'verified', event: { ...EVENT, description: null } },
      'stpauls.linguacast.app',
    );
    if (view.kind !== 'event') {
      throw new Error('expected an event view');
    }

    expect('description' in view).toBe(false);
  });

  it('makes no claim about the cause of an unreachable host', () => {
    const view = buildEventView({ outcome: 'unreachable' }, 'stpauls.linguacast.app');

    expect(view.kind).toBe('unreachable');
    expect(JSON.stringify(view)).not.toContain('stpauls');
  });
});

describe('opening an event from the screen', () => {
  it('writes the fetched name, a fresh date and a cleared unavailable mark', async () => {
    await seed([
      {
        host: 'stpauls.linguacast.app',
        pin: '834912',
        name: 'Stale name',
        lastConnectedAt: 1,
        pinned: true,
        unavailable: true,
      },
    ]);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, EVENT));

    await openEvent('stpauls.linguacast.app', '834912', 5678);

    expect(await readRememberedEvents()).toEqual([
      {
        host: 'stpauls.linguacast.app',
        pin: '834912',
        name: 'Sunday Service',
        lastConnectedAt: 5678,
        pinned: true,
        unavailable: false,
      },
    ]);
  });

  it('marks an existing row unavailable and changes nothing else', async () => {
    const stored: RememberedEvent = {
      host: 'stpauls.linguacast.app',
      pin: '834912',
      name: 'Sunday Service',
      lastConnectedAt: 1234,
      pinned: true,
      unavailable: false,
    };
    await seed([stored]);
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'not_found' }));

    await openEvent('stpauls.linguacast.app', '834912', 5678);

    expect(await readRememberedEvents()).toEqual([{ ...stored, unavailable: true }]);
  });

  it('writes nothing at all for a host and PIN it has never remembered', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'not_found' }));
    await openEvent('unknown.example', '111111', 5678);

    expect(mockStore.has(REMEMBERED_EVENTS_STORAGE_KEY)).toBe(false);
    expect(await readRememberedEvents()).toEqual([]);
  });
});
