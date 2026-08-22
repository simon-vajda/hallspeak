import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from '../default-hook';
import { requireAdmin } from '../middleware/require-admin.middleware';
import { adminChannelRoutes } from './admin/channels.routes';
import { adminEventRoutes } from './admin/events.routes';
import { adminLiveRoutes } from './admin/live.routes';
import { authRoutes } from './auth.routes';
import { publicEventRoutes } from './events.routes';
import { versionRoutes } from './version.routes';

const app = new OpenAPIHono({ defaultHook });

// The whole point of the /admin prefix: one mount covers every route under it. A separate
// statement rather than a link in the chain below, because `.use()` returns a plain Hono
// with no `.openapi()`, and before it because registration order is composition order.
app.use('/admin/*', requireAdmin);

/** Every route in this app is mounted here, without the /api prefix. */
export const apiRoutes = app
  .route('/', versionRoutes)
  .route('/', authRoutes)
  .route('/', publicEventRoutes)
  .route('/', adminEventRoutes)
  .route('/', adminChannelRoutes)
  .route('/', adminLiveRoutes);
