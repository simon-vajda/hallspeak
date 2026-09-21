import * as routes from '@hallspeak/contract/routes';
import { OpenAPIHono } from '@hono/zod-openapi';
import { MIN_MOBILE_VERSION, SERVER_VERSION } from '../../version';
import { defaultHook } from '../default-hook';

export const versionRoutes = new OpenAPIHono({ defaultHook }).openapi(routes.getVersion, (c) =>
  c.json(
    {
      serverVersion: SERVER_VERSION,
      minMobileVersion: MIN_MOBILE_VERSION,
    },
    200,
  ),
);
