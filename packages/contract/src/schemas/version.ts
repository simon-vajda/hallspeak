import { z } from '@hono/zod-openapi';

export const VersionResponse = z
  .object({
    apiVersion: z.string(),
    minClientVersion: z.string(),
    serverVersion: z.string(),
  })
  .openapi('VersionResponse');
