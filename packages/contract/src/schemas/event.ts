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
    // Enabled channels only, exactly as a disabled channel is invisible to a direct fetch.
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

// Admin surfaces key on `id`, never on `pin` or `speakerCode`: those are regenerable,
// so a page keyed on one moves out from under the admin the moment they regenerate it.
export const AdminEvent = z
  .object({
    id: z.int().positive(),
    pin: Pin,
    name: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    createdAt: z.int(),
    updatedAt: z.int(),
  })
  .openapi('AdminEvent');

export const AdminChannel = z
  .object({
    id: z.int().positive(),
    eventId: z.int().positive(),
    slug: Slug,
    name: z.string(),
    speakerCode: z.string(),
    enabled: z.boolean(),
    createdAt: z.int(),
    updatedAt: z.int(),
  })
  .openapi('AdminChannel');

export const AdminEventDetail = AdminEvent.extend({
  channels: z.array(AdminChannel),
}).openapi('AdminEventDetail');

export const CreateEventBody = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullish(),
    enabled: z.boolean().optional(),
  })
  .openapi('CreateEventBody');

export const UpdateEventBody = CreateEventBody.partial().openapi('UpdateEventBody');

export const CreateChannelBody = z
  .object({
    slug: Slug,
    name: z.string().min(1).max(120),
    enabled: z.boolean().optional(),
  })
  .openapi('CreateChannelBody');

// No `slug`: it is immutable after creation. Strict, so sending one is a 400 rather
// than a silent no-op.
export const UpdateChannelBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .openapi('UpdateChannelBody');
