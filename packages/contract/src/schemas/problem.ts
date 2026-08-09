import { z } from '@hono/zod-openapi';

export const Problem = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi('Problem');
