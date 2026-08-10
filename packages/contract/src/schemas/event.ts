import { z } from '@hono/zod-openapi';
import { PIN_PATTERN, SLUG_PATTERN } from './patterns';

export const Pin = z.string().regex(PIN_PATTERN).openapi({ example: '834912' });
export const Slug = z.string().min(1).max(40).regex(SLUG_PATTERN).openapi({ example: 'english' });

export const PublicChannel = z
  .object({
    slug: Slug,
    name: z.string(),
    online: z.boolean(),
  })
  .openapi('PublicChannel');

export const PublicEvent = z
  .object({
    pin: Pin,
    name: z.string(),
    description: z.string().nullable(),
    // Enabled channels only. A disabled channel is invisible here, exactly as it is
    // invisible to a direct fetch (spec E §4).
    channels: z.array(PublicChannel),
  })
  .openapi('PublicEvent');

export const PublicChannelView = z
  .object({
    event: z.object({ pin: Pin, name: z.string() }),
    channel: PublicChannel,
    role: z.enum(['listener', 'speaker']),
  })
  .openapi('PublicChannelView');
