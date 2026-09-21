import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PAGE_TITLE,
  formatChannelPageTitle,
  formatEventPageTitle,
} from '@hallspeak/contract/page-titles';
import { PIN_PATTERN, SLUG_PATTERN } from '@hallspeak/contract/patterns';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { html } from 'hono/html';
import { findEnabledChannelBySlug } from '../core/channels.service';
import { findEnabledEventByPin } from '../core/events.service';
import { db } from '../db';
import { createPublicRateLimit } from './middleware/rate-limit.middleware';

const INDEX_META_START = '<!-- hallspeak:metadata:start -->';
const INDEX_META_END = '<!-- hallspeak:metadata:end -->';

interface PageMetadata {
  title: string;
  description: string;
}

interface PageResponse {
  metadata: PageMetadata;
  status: 200 | 403 | 404 | 429;
}

const DEFAULT_METADATA: PageMetadata = {
  title: DEFAULT_PAGE_TITLE,
  description: 'Listen to live interpretation in your language.',
};

const LINK_NOT_FOUND: PageResponse = {
  metadata: {
    title: 'Link not found | Hallspeak',
    description: 'This link is no longer available.',
  },
  status: 404,
};

const SPEAKER_LINK_EXPIRED: PageResponse = {
  metadata: {
    title: 'Speaker link expired | Hallspeak',
    description: 'This speaker link is no longer valid. Ask the organiser for a current link.',
  },
  status: 403,
};

const RATE_LIMITED: PageResponse = {
  metadata: {
    title: 'Too many incorrect links | Hallspeak',
    description: 'Wait a moment before trying this link again.',
  },
  status: 429,
};

const EVENT_PATH = /^\/events\/([^/]+)\/?$/;
const CHANNEL_PATH = /^\/events\/([^/]+)\/([^/]+)\/?$/;

/** Splits once at boot, then only rebuilds the four escaped metadata tags per request. */
function createIndexRenderer(template: string) {
  const start = template.indexOf(INDEX_META_START);
  const end = template.indexOf(INDEX_META_END);
  const exactlyOnePair =
    start >= 0 &&
    end > start &&
    template.indexOf(INDEX_META_START, start + INDEX_META_START.length) === -1 &&
    template.indexOf(INDEX_META_END, end + INDEX_META_END.length) === -1;

  if (!exactlyOnePair) {
    throw new Error('Built index.html must contain exactly one Hallspeak metadata marker pair.');
  }

  const before = template.slice(0, start);
  const after = template.slice(end + INDEX_META_END.length);

  return async (metadata: PageMetadata): Promise<string> => {
    const tags = await html`<title>${metadata.title}</title>
    <meta name="description" content="${metadata.description}" />
    <meta property="og:title" content="${metadata.title}" />
    <meta property="og:description" content="${metadata.description}" />`;

    return `${before}${INDEX_META_START}\n    ${tags}\n    ${INDEX_META_END}${after}`;
  };
}

function metadataForPath(path: string, speakerCode: string | undefined): PageResponse {
  const channelMatch = CHANNEL_PATH.exec(path);
  if (channelMatch) {
    const [, pin, slug] = channelMatch;
    if (!pin || !PIN_PATTERN.test(pin)) {
      return LINK_NOT_FOUND;
    }

    const event = findEnabledEventByPin(db, pin);
    if (!event) {
      return LINK_NOT_FOUND;
    }
    if (!slug || !SLUG_PATTERN.test(slug)) {
      return LINK_NOT_FOUND;
    }

    const channel = findEnabledChannelBySlug(db, event.id, slug);
    if (!channel) {
      return LINK_NOT_FOUND;
    }
    if (speakerCode !== undefined && speakerCode !== channel.speakerCode) {
      return SPEAKER_LINK_EXPIRED;
    }

    const title = formatChannelPageTitle(event.name, channel.name);
    return {
      metadata: {
        title,
        description:
          speakerCode === undefined
            ? `Listen to ${event.name} on the ${channel.name} channel.`
            : `Join as the speaker on the ${channel.name} channel for ${event.name}.`,
      },
      status: 200,
    };
  }

  const eventMatch = EVENT_PATH.exec(path);
  if (eventMatch) {
    const pin = eventMatch[1];
    if (!pin || !PIN_PATTERN.test(pin)) {
      return LINK_NOT_FOUND;
    }

    const event = findEnabledEventByPin(db, pin);
    if (!event) {
      return LINK_NOT_FOUND;
    }

    return {
      metadata: {
        title: formatEventPageTitle(event.name),
        description: event.description ?? `Listen to ${event.name} live in your language.`,
      },
      status: 200,
    };
  }

  return { metadata: DEFAULT_METADATA, status: 200 };
}

/** Builds SPA routes when output exists. A present but malformed build is fatal. */
export function createSpaRoutes(webRoot: string): Hono | undefined {
  if (!existsSync(webRoot)) {
    return undefined;
  }

  const template = readFileSync(join(webRoot, 'index.html'), 'utf8');
  const render = createIndexRenderer(template);
  const app = new Hono();

  const respond = async (c: Context, page: PageResponse) => {
    c.header('Cache-Control', 'no-cache');
    return c.html(await render(page.metadata), page.status);
  };

  // A middleware wrapping serveStatic, not its onFound hook: serveStatic builds the
  // Response with c.body() before awaiting onFound, so headers set there land nowhere.
  app.use('*', async (c, next) => {
    await next();
    if (c.res.headers.get('Content-Type')?.startsWith('text/html')) {
      c.res.headers.set('Cache-Control', 'no-cache');
      return;
    }
    if (c.res.status !== 200 && c.res.status !== 206) {
      return;
    }
    // Vite content-hashes everything under /assets. Other files must revalidate.
    c.res.headers.set(
      'Cache-Control',
      c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
  });

  // Same public buckets as /api/events/*: HTML cannot become a PIN-enumeration bypass.
  app.get(
    '/events/*',
    createPublicRateLimit((c) => respond(c, RATE_LIMITED)),
  );

  // index.html is the one bundled file serveStatic must never answer directly.
  app.get('/index.html', (c) => respond(c, { metadata: DEFAULT_METADATA, status: 200 }));
  app.use('*', serveStatic({ root: webRoot }));
  app.get('*', (c) =>
    respond(c, metadataForPath(c.req.path, c.req.query('speaker_code') || undefined)),
  );

  return app;
}
