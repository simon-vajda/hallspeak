import { existsSync } from 'node:fs';
import { serveStatic } from '@hono/node-server/serve-static';
import { OpenAPIHono } from '@hono/zod-openapi';
import { buildOpenApiDocument } from '@linguacast/contract';
import { Scalar } from '@scalar/hono-api-reference';
import { env } from './env';
import { defaultHook } from './lib/default-hook';
import { toProblem } from './lib/problem';
import { apiRoutes } from './routes';

export const app = new OpenAPIHono({ defaultHook });

app.onError((err, c) => c.json(toProblem(err), 500));

// ---------------------------------------------------------------------------
// Mount order below is load-bearing. Hono composes matching handlers in
// registration order, so moving any of these blocks changes behaviour.
//
// Invisible from this file: src/signal attaches Socket.IO to the underlying
// http.Server, which intercepts /api/socket.io/* before Hono runs. That path
// therefore never reaches the /api/* 404 below, and adding a route for it here
// would have no effect.
// ---------------------------------------------------------------------------

// 1. The API itself.
app.route('/api', apiRoutes);
app.get('/api/openapi.json', (c) => c.json(buildOpenApiDocument()));
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

// 2. API 404s, BEFORE static serving. Without this an unmatched /api/typo falls
//    through to the SPA catch-all and returns index.html with a 200 to a fetch()
//    caller, which then fails on JSON parsing far from the cause.
app.all('/api/*', (c) =>
  c.json({ code: 'not_found', message: `No API endpoint for ${c.req.method} ${c.req.path}.` }, 404),
);

// 3 & 4. Static SPA. Registered only if a build exists: a server that refused to
//    start because a sibling package has not been built would make `pnpm dev`
//    fail on a fresh clone. Absent output is the dev configuration, and it is
//    exactly Spec A's behaviour.
if (existsSync(env.WEB_ROOT)) {
  // Cache-Control must be set from a middleware wrapping serveStatic, not from its
  // onFound hook: serveStatic builds the Response with c.body() and only then awaits
  // onFound, so headers set there land nowhere. This runs after the /api handlers
  // are registered, so it never touches an API response.
  app.use('*', async (c, next) => {
    await next();
    if (c.res.status !== 200 && c.res.status !== 206) return;
    // Vite content-hashes everything it emits under /assets, so those are immutable.
    // index.html must revalidate on every load, or a browser holding a cached shell
    // keeps requesting asset hashes that no longer exist after a deploy.
    c.res.headers.set(
      'Cache-Control',
      c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
  });

  app.use('*', serveStatic({ root: env.WEB_ROOT }));

  // Client-side routing fallback: any unmatched GET gets the SPA shell.
  app.get('*', serveStatic({ root: env.WEB_ROOT, rewriteRequestPath: () => '/index.html' }));
} else {
  console.log(`SPA serving disabled (no build output at ${env.WEB_ROOT})`);
}

// 5. Covers both the unmatched non-GET case and the whole server when there is
//    no SPA build.
app.notFound((c) => c.json({ code: 'not_found', message: 'Not found.' }, 404));
