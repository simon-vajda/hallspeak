import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import { createChannel, listChannels } from '../../core/channels.service';
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  regeneratePin,
  updateEvent,
} from '../../core/events.service';
import { db } from '../../db';
import { isUniqueViolation } from '../../db/errors';
import type { ChannelRow, EventRow } from '../../db/schema';
import { defaultHook } from '../../lib/default-hook';

/** Row → DTO. A row is not a DTO, which is why this mapping is written out. */
export function toAdminEvent(row: EventRow) {
  return {
    id: row.id,
    pin: row.pin,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAdminChannel(row: ChannelRow) {
  return {
    id: row.id,
    eventId: row.eventId,
    slug: row.slug,
    name: row.name,
    speakerCode: row.speakerCode,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function withChannels(row: EventRow) {
  return { ...toAdminEvent(row), channels: listChannels(db, row.id).map(toAdminChannel) };
}

const eventNotFound = { code: 'not_found', message: 'No such event.' } as const;

export const adminEventRoutes = new OpenAPIHono({ defaultHook })
  // A listChannels query per event, deliberately: the list is the only consumer, it needs
  // every event's channels for its chips, and this deployment shows tens of events on one
  // process. Simplicity over a join that has to be maintained.
  .openapi(routes.adminListEvents, (c) => c.json(listEvents(db).map(withChannels), 200))

  .openapi(routes.adminCreateEvent, (c) => {
    const input = c.req.valid('json');
    const event = createEvent(db, input);
    return c.json(withChannels(event), 201);
  })

  .openapi(routes.adminGetEvent, (c) => {
    const event = getEventById(db, c.req.valid('param').id);
    if (!event) return c.json(eventNotFound, 404);
    return c.json(withChannels(event), 200);
  })

  .openapi(routes.adminPatchEvent, (c) => {
    const updated = updateEvent(db, c.req.valid('param').id, c.req.valid('json'));
    if (!updated) return c.json(eventNotFound, 404);
    return c.json(withChannels(updated), 200);
  })

  .openapi(routes.adminDeleteEvent, (c) => {
    if (!deleteEvent(db, c.req.valid('param').id)) return c.json(eventNotFound, 404);
    // Channels go with it, by the FK's ON DELETE cascade — which is inert without the
    // foreign_keys pragma createDb sets.
    return c.body(null, 204);
  })

  .openapi(routes.adminRegeneratePin, (c) => {
    const updated = regeneratePin(db, c.req.valid('param').id);
    if (!updated) return c.json(eventNotFound, 404);
    return c.json(toAdminEvent(updated), 200);
  })

  .openapi(routes.adminCreateChannel, (c) => {
    const { id } = c.req.valid('param');
    if (!getEventById(db, id)) return c.json(eventNotFound, 404);

    try {
      return c.json(toAdminChannel(createChannel(db, id, c.req.valid('json'))), 201);
    } catch (err) {
      // The composite unique on (event_id, slug) is the check; a pre-read would race
      // it and still have to catch this.
      if (!isUniqueViolation(err)) throw err;
      return c.json(
        { code: 'slug_taken', message: 'That slug is already used on this event.' },
        409,
      );
    }
  });
