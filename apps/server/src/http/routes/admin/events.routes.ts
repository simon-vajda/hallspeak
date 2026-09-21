import * as routes from '@hallspeak/contract/routes';
import { OpenAPIHono } from '@hono/zod-openapi';
import { createChannel, listChannels } from '../../../core/channels.service';
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  regeneratePin,
  updateEvent,
} from '../../../core/events.service';
import { revokeEvent } from '../../../core/media';
import { db } from '../../../db';
import { isUniqueViolation } from '../../../db/errors';
import type { EventRow } from '../../../db/schema';
import { defaultHook } from '../../default-hook';
import { toAdminChannel } from '../../mappers/channels.mapper';
import { toAdminEvent } from '../../mappers/events.mapper';

function withChannels(row: EventRow) {
  return { ...toAdminEvent(row), channels: listChannels(db, row.id).map(toAdminChannel) };
}

const eventNotFound = { code: 'not_found', message: 'No such event.' } as const;

/**
 * Event-scoped revocation, published once against the event rather than once per known
 * peer. A regenerated PIN has to remove listeners who hold no media at all, and `core/`
 * has no socket id for them — the socket layer resolves the event against its own room
 * membership instead. Always after the write commits.
 */
function revokeAllAccess(eventId: number): void {
  revokeEvent(
    eventId,
    listChannels(db, eventId).map((channel) => channel.id),
    'access_revoked',
  );
}

export const adminEventRoutes = new OpenAPIHono({ defaultHook })
  // A listChannels query per event, deliberately: the one consumer needs every event's
  // channels, and this deployment shows tens of events. Simplicity over a join.
  .openapi(routes.adminListEvents, (c) => c.json(listEvents(db).map(withChannels), 200))

  .openapi(routes.adminCreateEvent, (c) => {
    const input = c.req.valid('json');
    const event = createEvent(db, input);
    return c.json(withChannels(event), 201);
  })

  .openapi(routes.adminGetEvent, (c) => {
    const event = getEventById(db, c.req.valid('param').id);
    if (!event) {
      return c.json(eventNotFound, 404);
    }
    return c.json(withChannels(event), 200);
  })

  .openapi(routes.adminPatchEvent, (c) => {
    const updated = updateEvent(db, c.req.valid('param').id, c.req.valid('json'));
    if (!updated) {
      return c.json(eventNotFound, 404);
    }
    // Only disabling revokes; a rename or an enable takes nobody's access away.
    if (updated.enabled === false) {
      revokeAllAccess(updated.id);
    }
    return c.json(withChannels(updated), 200);
  })

  .openapi(routes.adminDeleteEvent, (c) => {
    const { id } = c.req.valid('param');
    // Read the channel ids before the cascade takes the rows with the event.
    const channelIds = listChannels(db, id).map((channel) => channel.id);
    if (!deleteEvent(db, id)) {
      return c.json(eventNotFound, 404);
    }
    // Channels go with it by ON DELETE cascade, inert without the foreign_keys pragma.
    revokeEvent(id, channelIds, 'access_revoked');
    return c.body(null, 204);
  })

  .openapi(routes.adminRegeneratePin, (c) => {
    const updated = regeneratePin(db, c.req.valid('param').id);
    if (!updated) {
      return c.json(eventNotFound, 404);
    }
    // The old PIN is what those sockets connected with, so they have to go — including
    // listeners who own no media for core/ to name.
    revokeAllAccess(updated.id);
    return c.json(toAdminEvent(updated), 200);
  })

  .openapi(routes.adminCreateChannel, (c) => {
    const { id } = c.req.valid('param');
    if (!getEventById(db, id)) {
      return c.json(eventNotFound, 404);
    }

    try {
      return c.json(toAdminChannel(createChannel(db, id, c.req.valid('json'))), 201);
    } catch (err) {
      // The composite unique on (event_id, slug) is the check: a pre-read would race it.
      if (!isUniqueViolation(err)) {
        throw err;
      }
      return c.json(
        { code: 'slug_taken', message: 'That slug is already used on this event.' },
        409,
      );
    }
  });
