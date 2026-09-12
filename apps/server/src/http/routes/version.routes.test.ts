import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import serverManifest from '../../../package.json' with { type: 'json' };
import { createTestApi } from '../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let cleanup: () => void;

beforeAll(async () => {
  ({ api, cleanup } = await createTestApi());
});

afterAll(() => cleanup());

describe('GET /version', () => {
  it('reports canonical server version and mobile floor', async () => {
    const response = await api.request('/version');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      serverVersion: serverManifest.version,
      minMobileVersion: '0.3.0',
    });
  });
});
