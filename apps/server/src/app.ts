import { OpenAPIHono } from '@hono/zod-openapi';
import { buildOpenApiDocument } from '@linguacast/contract';
import { Scalar } from '@scalar/hono-api-reference';
import { defaultHook } from './lib/default-hook';
import { toProblem } from './lib/problem';
import { apiRoutes } from './routes';

export const app = new OpenAPIHono({ defaultHook });

app.onError((err, c) => c.json(toProblem(err), 500));

app.route('/api', apiRoutes);
app.get('/api/openapi.json', (c) => c.json(buildOpenApiDocument()));
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));
