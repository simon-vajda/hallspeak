import * as routes from '@hallspeak/contract/routes';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  deleteChannel,
  getChannelById,
  regenerateSpeakerCode,
  updateChannel,
} from '../../../core/channels.service';
import { revokeChannel } from '../../../core/media';
import { db } from '../../../db';
import { defaultHook } from '../../default-hook';
import { toAdminChannel } from '../../mappers/channels.mapper';

// Channels are addressed directly rather than under their event: nesting would buy a
// consistency check the FK already guarantees.
const channelNotFound = { code: 'not_found', message: 'No such channel.' } as const;

/**
 * Every write here that takes access away also stops the audio, and always *after* the
 * write has committed: the database stays the authority on what is enabled, and the
 * socket layer does the disconnecting from the published fact. Without this, a
 * regenerated speaker code would leave whoever holds the old one broadcasting — which is
 * the entire purpose of regenerating it.
 */
export const adminChannelRoutes = new OpenAPIHono({ defaultHook })
  .openapi(routes.adminPatchChannel, (c) => {
    const updated = updateChannel(db, c.req.valid('param').id, c.req.valid('json'));
    if (!updated) {
      return c.json(channelNotFound, 404);
    }
    // Only disabling revokes; a rename or an enable takes nobody's access away.
    if (updated.enabled === false) {
      revokeChannel(updated.eventId, updated.id, 'access_revoked');
    }
    return c.json(toAdminChannel(updated), 200);
  })

  .openapi(routes.adminDeleteChannel, (c) => {
    const { id } = c.req.valid('param');
    // Read before the delete: the row is what names the event to revoke against.
    const channel = getChannelById(db, id);
    if (!deleteChannel(db, id)) {
      return c.json(channelNotFound, 404);
    }
    if (channel) {
      revokeChannel(channel.eventId, channel.id, 'access_revoked');
    }
    return c.body(null, 204);
  })

  .openapi(routes.adminRegenerateSpeakerCode, (c) => {
    const updated = regenerateSpeakerCode(db, c.req.valid('param').id);
    if (!updated) {
      return c.json(channelNotFound, 404);
    }
    // The sole mitigation for a leaked speaker code, and worth nothing unless it also
    // evicts whoever is holding the old one right now.
    revokeChannel(updated.eventId, updated.id, 'access_revoked');
    return c.json(toAdminChannel(updated), 200);
  });
