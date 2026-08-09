import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from '../lib/default-hook';
import { versionRoutes } from './version';

/** Every route in this app is mounted here, without the /api prefix. */
export const apiRoutes = new OpenAPIHono({ defaultHook }).route('/', versionRoutes);
