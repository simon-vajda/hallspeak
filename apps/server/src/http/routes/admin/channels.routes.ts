import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import {
  deleteChannel,
  regenerateSpeakerCode,
  updateChannel,
} from '../../../core/channels.service';
import { db } from '../../../db';
import { defaultHook } from '../../default-hook';
import { toAdminChannel } from '../../mappers/channels.mapper';

// Channels are addressed directly rather than under their event: nesting would buy a
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
    // The sole mitigation for a leaked speaker code.
    return c.json(toAdminChannel(updated), 200);
  });
