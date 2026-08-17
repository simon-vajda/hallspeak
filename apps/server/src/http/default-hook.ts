import type { Hook } from '@hono/zod-openapi';
import type { Env } from 'hono';
import { z } from 'zod';

/**
 * Turns @hono/zod-openapi validation failures into a 400 with a Problem body. Must be
 * passed to every OpenAPIHono that calls .openapi(): sub-apps do not inherit it.
 */
export const defaultHook: Hook<unknown, Env, string, unknown> = (result, c) => {
  if (!result.success) {
    return c.json({ code: 'invalid_request', message: z.prettifyError(result.error) }, 400);
  }
};
