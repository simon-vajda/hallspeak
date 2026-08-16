import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from '../default-hook';
import { adminChannelRoutes } from './admin/channels.routes';
import { adminEventRoutes } from './admin/events.routes';
import { publicEventRoutes } from './events.routes';
import { versionRoutes } from './version.routes';

/** Every route in this app is mounted here, without the /api prefix. */
export const apiRoutes = new OpenAPIHono({ defaultHook })
  .route('/', versionRoutes)
  .route('/', publicEventRoutes)
  .route('/', adminEventRoutes)
  .route('/', adminChannelRoutes);
