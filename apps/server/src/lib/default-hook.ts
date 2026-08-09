import type { Hook } from '@hono/zod-openapi';
import type { Env } from 'hono';
import { z } from 'zod';

/**
 * Turns @hono/zod-openapi request-validation failures into a 400 with a Problem body.
 * Must be passed to the constructor of every OpenAPIHono instance that calls .openapi() —
 * it is not inherited by sub-apps mounted with .route().
 */
export const defaultHook: Hook<unknown, Env, string, unknown> = (result, c) => {
  if (!result.success) {
    return c.json({ code: 'invalid_request', message: z.prettifyError(result.error) }, 400);
  }
};
