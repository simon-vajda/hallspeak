import * as routes from '@hallspeak/contract/routes';
import { OpenAPIHono } from '@hono/zod-openapi';
import { type EventListenerCounts, listenerCounts } from '../../../core/media';
import { defaultHook } from '../../default-hook';

/**
 * The media layer is the only source here: no database is read, so an event with no active
 * room is simply absent and the client reads absence as zero. That covers the idle grace
 * period too — a room whose producers have all closed enumerates no channels, and an event
 * with none of them is dropped rather than reported as an empty shell.
 */
function toLiveEvents(counts: EventListenerCounts[]) {
  return counts
    .filter((event) => event.channels.length > 0)
    .map((event) => ({
      eventId: event.eventId,
      channels: event.channels.map(({ channelId, slug, count }) => ({
        channelId,
        slug,
        // Always true: the facade enumerates live channels only. Stated rather than
        // inferred, so the client reads a flag instead of deriving liveness from presence.
        online: true,
        listeners: count,
      })),
    }));
}

export const adminLiveRoutes = new OpenAPIHono({ defaultHook })
  // `listenerCounts()` answers an empty array when media is not running, so a server
  // started without it reports nothing live rather than failing.
  .openapi(routes.adminGetLive, (c) => c.json(toLiveEvents(listenerCounts()), 200));
