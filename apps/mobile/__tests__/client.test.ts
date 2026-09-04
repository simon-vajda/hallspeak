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
import { readRememberedEvents } from '../src/venues/storage';

const EVENT = {
  pin: '834912',
  name: 'Sunday Service',
  description: null,
  channels: [{ slug: 'english', name: 'English', online: true }],
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn<typeof fetch>();

beforeEach(() => {
  mockStore.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('fetchPublicEvent', () => {
  it('addresses the host it was given over https, with no app-wide base URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, EVENT));
    await fetchPublicEvent('host.example:8443', '834912');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://host.example:8443/api/events/834912');
  });

  it('maps a 200 to a verified event', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, EVENT));
    await expect(fetchPublicEvent('host.example', '834912')).resolves.toEqual({
      outcome: 'verified',
      event: EVENT,
    });
  });

  it('maps a rejected fetch and a 404 to two different results', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(fetchPublicEvent('host.example', '834912')).resolves.toEqual({
      outcome: 'unreachable',
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'not_found' }));
    await expect(fetchPublicEvent('host.example', '834912')).resolves.toEqual({
      outcome: 'not_found',
    });
  });

  it('reports a rate-limited or broken response as unreachable, never as a missing event', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { code: 'rate_limited' }));
    await expect(fetchPublicEvent('host.example', '834912')).resolves.toEqual({
      outcome: 'unreachable',
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { nothing: 'useful' }));
    await expect(fetchPublicEvent('host.example', '834912')).resolves.toEqual({
      outcome: 'unreachable',
    });
  });
});

describe('openEvent', () => {
  it('writes the event into the history as a side effect of a successful open', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, EVENT));
    const result = await openEvent('host.example', '834912', 1234);

    expect(result.outcome).toBe('verified');
    expect(await readRememberedEvents()).toEqual([
      {
        host: 'host.example',
        pin: '834912',
        name: 'Sunday Service',
        lastConnectedAt: 1234,
        pinned: false,
        unavailable: false,
      },
    ]);
  });

  it('writes nothing when the event is missing or the host is unreachable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'not_found' }));
    await openEvent('host.example', '834912', 1);
    expect(await readRememberedEvents()).toEqual([]);

    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await openEvent('host.example', '834912', 2);
    expect(await readRememberedEvents()).toEqual([]);
  });

  it('marks an already remembered event unavailable when its open fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, EVENT));
    await openEvent('host.example', '834912', 1234);

    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'not_found' }));
    await openEvent('host.example', '834912', 5678);

    const [stored] = await readRememberedEvents();
    expect(stored).toEqual({
      host: 'host.example',
      pin: '834912',
      name: 'Sunday Service',
      lastConnectedAt: 1234,
      pinned: false,
      unavailable: true,
    });
  });
});
