import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createTestApi } from '../testing/api';

const INDEX = `<!doctype html>
<html>
  <head>
    <!-- linguacast:metadata:start -->
    <title>LinguaCast</title>
    <meta name="description" content="Listen to live interpretation in your language." />
    <meta property="og:title" content="LinguaCast" />
    <meta property="og:description" content="Listen to live interpretation in your language." />
    <!-- linguacast:metadata:end -->
    <script type="module" src="/assets/app-hash.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const SPEAKER_CODE = 'speaker-secret';
const from = (ip: string) => ({ incoming: { socket: { remoteAddress: ip } } });

let app: typeof import('../app')['app'];
let db: Db;
let cleanupApi: () => void;
let webRoot: string;
let originalWebRoot: string | undefined;
let createSpaRoutes: typeof import('./spa.routes')['createSpaRoutes'];

beforeAll(async () => {
  webRoot = mkdtempSync(join(tmpdir(), 'linguacast-web-'));
  mkdirSync(join(webRoot, 'assets'));
  writeFileSync(join(webRoot, 'index.html'), INDEX);
  writeFileSync(join(webRoot, 'assets', 'app-hash.js'), 'console.log("asset");');

  originalWebRoot = process.env.WEB_ROOT;
  process.env.WEB_ROOT = webRoot;

  const testApi = await createTestApi();
  ({ db, cleanup: cleanupApi } = testApi);

  const [{ createEvent }, { createChannel }, spaModule] = await Promise.all([
    import('../core/events.service'),
    import('../core/channels.service'),
    import('./spa.routes'),
  ]);
  ({ createSpaRoutes } = spaModule);

  const event = createEvent(
    db,
    { name: 'Sunday Service', description: 'Weekly gathering.', enabled: true },
    () => '123456',
  );
  createChannel(
    db,
    event.id,
    { slug: 'english', name: 'English', enabled: true },
    () => SPEAKER_CODE,
  );
  createChannel(db, event.id, { slug: 'hidden', name: 'Hidden' }, () => 'hidden-secret');
  createEvent(db, { name: 'No Description', enabled: true }, () => '123457');
  createEvent(db, { name: 'Disabled Event' }, () => '123458');

  const hostile = createEvent(
    db,
    {
      name: 'Event <script>alert("title")</script> & Friends',
      description: 'Description " onmouseover="alert(1)" <b>unsafe</b>',
      enabled: true,
    },
    () => '123459',
  );
  createChannel(
    db,
    hostile.id,
    { slug: 'escape', name: 'English <img src=x onerror=alert(1)>', enabled: true },
    () => 'escape-secret',
  );

  ({ app } = await import('../app'));
});

afterAll(() => {
  cleanupApi();
  rmSync(webRoot, { recursive: true, force: true });
  if (originalWebRoot === undefined) {
    delete process.env.WEB_ROOT;
  } else {
    process.env.WEB_ROOT = originalWebRoot;
  }
});

describe('SPA build handling', () => {
  it('leaves SPA routes disabled when build directory is absent', () => {
    expect(createSpaRoutes(join(webRoot, 'absent'))).toBeUndefined();
  });

  it('fails on a present build without the metadata markers', () => {
    const malformed = join(webRoot, 'malformed');
    mkdirSync(malformed);
    writeFileSync(join(malformed, 'index.html'), '<html><title>LinguaCast</title></html>');

    expect(() => createSpaRoutes(malformed)).toThrow(
      'Built index.html must contain exactly one LinguaCast metadata marker pair.',
    );
  });

  it('fails on a present build without index.html', () => {
    const missingIndex = join(webRoot, 'missing-index');
    mkdirSync(missingIndex);

    expect(() => createSpaRoutes(missingIndex)).toThrow(/ENOENT|no such file/i);
  });
});

describe('static files and default shell', () => {
  it('renders index.html dynamically with default metadata', async () => {
    const response = await app.request('/index.html');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(body).toContain('<title>LinguaCast</title>');
    expect(body).toContain(
      '<meta name="description" content="Listen to live interpretation in your language." />',
    );
    expect(body).toContain('/assets/app-hash.js');
  });

  it('uses default metadata for an unknown non-event SPA route', async () => {
    const response = await app.request('/somewhere');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>LinguaCast</title>');
  });

  it('serves hashed assets unchanged with immutable caching', async () => {
    const response = await app.request('/assets/app-hash.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(await response.text()).toBe('console.log("asset");');
  });

  it('keeps unmatched API requests outside the SPA', async () => {
    const response = await app.request('/api/missing');

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });
});

describe('public-link metadata', () => {
  it('renders stored event metadata', async () => {
    const response = await app.request('/events/123456');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('<title>Sunday Service | LinguaCast</title>');
    expect(body).toContain('<meta name="description" content="Weekly gathering." />');
    expect(body).toContain('<meta property="og:title" content="Sunday Service | LinguaCast" />');
    expect(body).toContain('<meta property="og:description" content="Weekly gathering." />');
  });

  it('uses event fallback copy when description is null', async () => {
    const response = await app.request('/events/123457/');

    expect(await response.text()).toContain(
      '<meta name="description" content="Listen to No Description live in your language." />',
    );
  });

  it('renders listener channel metadata for absent or empty speaker codes', async () => {
    for (const suffix of ['', '?speaker_code=']) {
      const response = await app.request(`/events/123456/english${suffix}`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('<title>Sunday Service - English | LinguaCast</title>');
      expect(body).toContain(
        '<meta name="description" content="Listen to Sunday Service on the English channel." />',
      );
    }
  });

  it('renders speaker copy after validating the code without exposing it', async () => {
    const response = await app.request(`/events/123456/english?speaker_code=${SPEAKER_CODE}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(
      '<meta name="description" content="Join as the speaker on the English channel for Sunday Service." />',
    );
    expect(body).not.toContain(SPEAKER_CODE);
  });

  it('returns specific generic metadata for missing resources and stale speaker links', async () => {
    const cases = [
      ['/events/000000', 404, 'Event not found | LinguaCast'],
      ['/events/not-a-pin', 404, 'Event not found | LinguaCast'],
      ['/events/123456/missing', 404, 'Channel not found | LinguaCast'],
      ['/events/123456/INVALID', 404, 'Channel not found | LinguaCast'],
      ['/events/123456/english?speaker_code=wrong', 403, 'Speaker link expired | LinguaCast'],
    ] as const;

    for (const [path, status, title] of cases) {
      const response = await app.request(path, undefined, from(`10.0.0.${status}`));
      expect(response.status).toBe(status);
      expect(await response.text()).toContain(`<title>${title}</title>`);
    }
  });

  it('answers identically for disabled and nonexistent events or channels', async () => {
    const missingEvent = await app.request('/events/000001', undefined, from('10.0.1.1'));
    const disabledEvent = await app.request('/events/123458', undefined, from('10.0.1.2'));
    const missingChannel = await app.request('/events/123456/missing', undefined, from('10.0.1.3'));
    const disabledChannel = await app.request('/events/123456/hidden', undefined, from('10.0.1.4'));

    expect(await missingEvent.text()).toBe(await disabledEvent.text());
    expect(await missingChannel.text()).toBe(await disabledChannel.text());
  });

  it('escapes event and channel content in text and attributes', async () => {
    const eventResponse = await app.request('/events/123459');
    const eventBody = await eventResponse.text();
    const channelResponse = await app.request('/events/123459/escape');
    const channelBody = await channelResponse.text();

    expect(eventBody).toContain(
      'Event &lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt; &amp; Friends',
    );
    expect(eventBody).toContain('&lt;b&gt;unsafe&lt;/b&gt;');
    expect(eventBody).not.toContain('<script>alert("title")</script>');
    expect(channelBody).toContain('English &lt;img src=x onerror=alert(1)&gt;');
    expect(channelBody).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('shares failed-lookup budget with the API and renders an HTML 429 shell', async () => {
    const origin = from('10.20.30.40');
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await app.request('/events/999999', undefined, origin)).status).toBe(404);
      expect((await app.request('/api/events/999999', undefined, origin)).status).toBe(404);
    }

    const response = await app.request('/events/999999', undefined, origin);
    const body = await response.text();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(body).toContain('<title>Too many incorrect links | LinguaCast</title>');
  });
});
