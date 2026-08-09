import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import { defaultHook } from '../lib/default-hook';
import { API_VERSION, MIN_CLIENT_VERSION, SERVER_VERSION } from '../version';

export const versionRoutes = new OpenAPIHono({ defaultHook }).openapi(routes.getVersion, (c) =>
  c.json(
    {
      apiVersion: API_VERSION,
      minClientVersion: MIN_CLIENT_VERSION,
      serverVersion: SERVER_VERSION,
    },
    200,
  ),
);
