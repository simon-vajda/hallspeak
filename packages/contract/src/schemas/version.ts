import { z } from '@hono/zod-openapi';
import { SEMVER_PATTERN } from './patterns';

export const VersionResponse = z
  .object({
    serverVersion: z.string().regex(SEMVER_PATTERN),
    minMobileVersion: z.string().regex(SEMVER_PATTERN),
  })
  .openapi('VersionResponse');
