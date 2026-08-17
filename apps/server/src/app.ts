import { existsSync } from 'node:fs';
import { serveStatic } from '@hono/node-server/serve-static';
import { OpenAPIHono } from '@hono/zod-openapi';
import { buildOpenApiDocument } from '@linguacast/contract';
import { Scalar } from '@scalar/hono-api-reference';
import { env } from './env';
import { defaultHook } from './http/default-hook';
import { apiRoutes } from './http/routes';
import { toProblem } from './lib/problem';

export const app = new OpenAPIHono({ defaultHook });

app.onError((err, c) => c.json(toProblem(err), 500));

// Mount order below is load-bearing: Hono composes matching handlers in registration order.
// Invisible from here: src/socket intercepts /api/socket.io/* on the underlying http.Server
// before Hono runs, so that path never reaches the /api/* 404 below.
app.route('/api', apiRoutes);
app.get('/api/openapi.json', (c) => c.json(buildOpenApiDocument()));
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

// Before static serving: otherwise an unmatched /api/typo falls through to the SPA
// catch-all and returns index.html with a 200 to a fetch() caller.
app.all('/api/*', (c) =>
  c.json({ code: 'not_found', message: `No API endpoint for ${c.req.method} ${c.req.path}.` }, 404),
);

// Registered only if a build exists: absent output is the dev configuration, and refusing
// to start over an unbuilt sibling would make `pnpm dev` fail on a fresh clone.
if (existsSync(env.WEB_ROOT)) {
  // A middleware wrapping serveStatic, not its onFound hook: serveStatic builds the
  // Response with c.body() before awaiting onFound, so headers set there land nowhere.
  app.use('*', async (c, next) => {
    await next();
    if (c.res.status !== 200 && c.res.status !== 206) return;
    // Vite content-hashes everything under /assets. index.html must revalidate, or a
    // browser holding a cached shell requests asset hashes that no longer exist.
    c.res.headers.set(
      'Cache-Control',
      c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
  });

  app.use('*', serveStatic({ root: env.WEB_ROOT }));

  app.get('*', serveStatic({ root: env.WEB_ROOT, rewriteRequestPath: () => '/index.html' }));
} else {
  console.log(`SPA serving disabled (no build output at ${env.WEB_ROOT})`);
}

// Covers the unmatched non-GET case, and the whole server when there is no SPA build.
app.notFound((c) => c.json({ code: 'not_found', message: 'Not found.' }, 404));
