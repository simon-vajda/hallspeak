import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import { db } from '../db';
import type { ChannelRow } from '../db/schema';
import {
  findEnabledChannelBySlug,
  findEnabledEventByPin,
  listEnabledChannels,
} from '../events/queries';
import { defaultHook } from '../lib/default-hook';
import { presence } from '../signal/presence';

/**
 * One body for every miss. A disabled event, a disabled channel and a nonexistent PIN
 * must be indistinguishable in status, body and shape, or a scanner learns which PINs
 * are real for free (spec E §5). Enforced by a test, not by discipline.
 */
const NOT_FOUND = { code: 'not_found', message: 'Not found.' } as const;

/** `online` comes from the presence registry — see the placeholder note there. */
function toPublicChannel(channel: ChannelRow) {
  return { slug: channel.slug, name: channel.name, online: presence.isOnline(channel.id) };
}

export const publicEventRoutes = new OpenAPIHono({ defaultHook })
  .openapi(routes.getPublicEvent, (c) => {
    const { pin } = c.req.valid('param');
    const event = findEnabledEventByPin(db, pin);
    if (!event) return c.json(NOT_FOUND, 404);

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
    if (!event) return c.json(NOT_FOUND, 404);

    const channel = findEnabledChannelBySlug(db, event.id, slug);
    // Checked before the code, so a valid code for a disabled channel still 404s and
    // never confirms that the code was right.
    if (!channel) return c.json(NOT_FOUND, 404);

    if (speakerCode !== undefined && speakerCode !== channel.speakerCode) {
      return c.json(
        { code: 'invalid_speaker_code', message: 'That code is not valid for this channel.' },
        403,
      );
    }

    const role = speakerCode === undefined ? 'listener' : 'speaker';
    return c.json(
      {
        event: { pin: event.pin, name: event.name },
        channel: toPublicChannel(channel),
        role,
      },
      200,
    );
  });
