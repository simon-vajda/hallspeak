import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import { findEnabledChannelBySlug, listEnabledChannels } from '../../core/channels.service';
import { findEnabledEventByPin } from '../../core/events.service';
import { db } from '../../db';
import { defaultHook } from '../default-hook';
import { toPublicChannel } from '../mappers/channels.mapper';
import { publicRateLimit } from '../middleware/rate-limit.middleware';

/**
 * One body for every miss: a disabled event, a disabled channel and a nonexistent PIN
 * must be byte-identical, or a scanner learns which PINs are real. Enforced by a test.
 */
const NOT_FOUND = { code: 'not_found', message: 'Not found.' } as const;

const app = new OpenAPIHono({ defaultHook });

// Before the handlers: registration order is composition order in Hono. A separate
// statement rather than a link in the chain below, because `.use()` returns a plain Hono
// with no `.openapi()`.
app.use('/events/*', publicRateLimit);

export const publicEventRoutes = app
  .openapi(routes.getPublicEvent, (c) => {
    const { pin } = c.req.valid('param');
    const event = findEnabledEventByPin(db, pin);
    if (!event) {
      return c.json(NOT_FOUND, 404);
    }

    return c.json(
      {
        pin: event.pin,
        name: event.name,
        description: event.description,
        channels: listEnabledChannels(db, event.id).map(toPublicChannel),
      },
      200,
    );
  })
  .openapi(routes.getPublicChannel, (c) => {
    const { pin, slug } = c.req.valid('param');
    // An empty ?speaker_code= is treated as absent rather than as a wrong code.
    const speakerCode = c.req.valid('query').speaker_code || undefined;

    const event = findEnabledEventByPin(db, pin);
    if (!event) {
      return c.json(NOT_FOUND, 404);
    }

    const channel = findEnabledChannelBySlug(db, event.id, slug);
    // Before the code, so a valid code on a disabled channel still 404s.
    if (!channel) {
      return c.json(NOT_FOUND, 404);
    }

    if (speakerCode !== undefined && speakerCode !== channel.speakerCode) {
      return c.json(
        { code: 'invalid_speaker_code', message: 'That code is not valid for this channel.' },
        403,
      );
    }

    // Annotated because a conditional over two string literals widens to `string`.
    const role: 'listener' | 'speaker' = speakerCode === undefined ? 'listener' : 'speaker';
    return c.json(
      {
        event: { pin: event.pin, name: event.name },
        channel: toPublicChannel(channel),
        role,
      },
      200,
    );
  });
