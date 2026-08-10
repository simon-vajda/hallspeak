import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from '../lib/default-hook';
import { adminEventRoutes } from './admin/events';
import { publicEventRoutes } from './events';
import { versionRoutes } from './version';

/** Every route in this app is mounted here, without the /api prefix. */
export const apiRoutes = new OpenAPIHono({ defaultHook })
  .route('/', versionRoutes)
  .route('/', publicEventRoutes)
  .route('/', adminEventRoutes);
