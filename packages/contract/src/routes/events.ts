import { createRoute, z } from '@hono/zod-openapi';
import { Pin, PublicChannelView, PublicEvent, Slug } from '../schemas/event';
import { Problem } from '../schemas/problem';

const problem = (description: string) => ({
  content: { 'application/json': { schema: Problem } },
  description,
});

export const getPublicEvent = createRoute({
  method: 'get',
  path: '/events/{pin}',
  tags: ['Public'],
  summary: 'An event and its enabled channels',
  request: { params: z.object({ pin: Pin }) },
  responses: {
    200: { content: { 'application/json': { schema: PublicEvent } }, description: 'OK' },
    // Byte-identical for a disabled event and for a nonexistent PIN: any difference
    // tells a scanner which PINs are real.
    404: problem('No such event'),
    429: problem('Too many failed lookups'),
  },
});

export const getPublicChannel = createRoute({
  method: 'get',
  path: '/events/{pin}/{slug}',
  tags: ['Public'],
  summary: 'One channel, and the role of the caller on it',
  request: {
    params: z.object({ pin: Pin, slug: Slug }),
    // A query param, not a header: the page URL already carries the code into the access log.
    query: z.object({ speaker_code: z.string().optional() }),
  },
  responses: {
    200: { content: { 'application/json': { schema: PublicChannelView } }, description: 'OK' },
    403: problem('The speaker code does not match this channel'),
    404: problem('No such event or channel'),
    429: problem('Too many failed lookups'),
  },
});
