import { describe, expect, it } from '@jest/globals';
import { shouldRetryApiQuery } from '@linguacast/client-core/query-retry';
import { apiBaseUrl, createApiClient } from './client';
import { unavailable } from './problem';
import { channelQueryKey, eventQueryKey } from './queries';

describe('apiBaseUrl', () => {
  it('composes an HTTPS origin from a bare host', () => {
    expect(apiBaseUrl('stpauls.linguacast.app')).toBe('https://stpauls.linguacast.app/api');
  });

  it('keeps a port intact', () => {
    expect(apiBaseUrl('example.com:8443')).toBe('https://example.com:8443/api');
  });
});

describe('unavailable', () => {
  it('carries a Problem body a screen can read', async () => {
    const response = unavailable(503, 'The server could not be reached.');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'unavailable',
      message: 'The server could not be reached.',
    });
  });
});

describe('shouldRetryApiQuery', () => {
  it('declines a domain refusal the same request cannot fix', () => {
    expect(shouldRetryApiQuery(0, { code: 'not_found' })).toBe(false);
    expect(shouldRetryApiQuery(0, { code: 'rate_limited' })).toBe(false);
  });

  it('retries a transport failure up to its cap', () => {
    expect(shouldRetryApiQuery(0, { code: 'unavailable' })).toBe(true);
    expect(shouldRetryApiQuery(2, { code: 'unavailable' })).toBe(true);
    expect(shouldRetryApiQuery(3, { code: 'unavailable' })).toBe(false);
  });
});

describe('client middleware', () => {
  const failing = (status: number, body: string) => async () =>
    new Response(body, { status, headers: { 'content-type': 'application/json' } });

  it('turns an empty-bodied proxy error into a Problem rather than a success', async () => {
    const client = createApiClient('a.example', failing(502, ''));
    const { data, error } = await client.GET('/events/{pin}', {
      params: { path: { pin: '834912' } },
    });

    expect(data).toBeUndefined();
    expect(error).toEqual({ code: 'unavailable', message: 'The server returned 502.' });
  });

  it('turns a rejected fetch into a Problem with status 503', async () => {
    const client = createApiClient('a.example', async () => {
      throw new TypeError('Network request failed');
    });
    const { data, error } = await client.GET('/events/{pin}', {
      params: { path: { pin: '834912' } },
    });

    expect(data).toBeUndefined();
    expect(error).toEqual({ code: 'unavailable', message: 'The server could not be reached.' });
  });

  it("passes the server's own refusal through unchanged", async () => {
    const client = createApiClient(
      'a.example',
      failing(404, JSON.stringify({ code: 'not_found', message: 'No such event.' })),
    );
    const { error } = await client.GET('/events/{pin}', { params: { path: { pin: '834912' } } });

    expect(error).toEqual({ code: 'not_found', message: 'No such event.' });
  });
});

describe('cache keys', () => {
  it('separates the same PIN on two servers', () => {
    expect(eventQueryKey('a.example', '834912')).not.toEqual(eventQueryKey('b.example', '834912'));
    expect(channelQueryKey('a.example', '834912', 'magyar')).not.toEqual(
      channelQueryKey('b.example', '834912', 'magyar'),
    );
  });
});
