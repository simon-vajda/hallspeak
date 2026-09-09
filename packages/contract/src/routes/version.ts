import { createRoute } from '@hono/zod-openapi';
import { VersionResponse } from '../schemas/version';

export const getVersion = createRoute({
  method: 'get',
  path: '/version',
  tags: ['Meta'],
  summary: 'Server and minimum supported mobile versions',
  responses: {
    200: {
      content: { 'application/json': { schema: VersionResponse } },
      description: 'OK',
    },
  },
});
