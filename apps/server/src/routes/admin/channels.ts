import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import { db } from '../../db';
import { deleteChannel, regenerateSpeakerCode, updateChannel } from '../../events/queries';
import { defaultHook } from '../../lib/default-hook';
import { toAdminChannel } from './events';

// Channels are addressed directly rather than under their event: the admin edits one
// from a list where the event is already established, and nesting would buy a
// consistency check the FK already guarantees.
const channelNotFound = { code: 'not_found', message: 'No such channel.' } as const;

export const adminChannelRoutes = new OpenAPIHono({ defaultHook })
  .openapi(routes.adminPatchChannel, (c) => {
    const updated = updateChannel(db, c.req.valid('param').id, c.req.valid('json'));
    if (!updated) return c.json(channelNotFound, 404);
    return c.json(toAdminChannel(updated), 200);
  })

  .openapi(routes.adminDeleteChannel, (c) => {
    if (!deleteChannel(db, c.req.valid('param').id)) return c.json(channelNotFound, 404);
    return c.body(null, 204);
  })

  .openapi(routes.adminRegenerateSpeakerCode, (c) => {
    const updated = regenerateSpeakerCode(db, c.req.valid('param').id);
    if (!updated) return c.json(channelNotFound, 404);
    // The sole mitigation for a leaked code: a forwarded email, a photographed address
    // bar and a screen-share all have this same answer (spec E §5).
    return c.json(toAdminChannel(updated), 200);
  });
