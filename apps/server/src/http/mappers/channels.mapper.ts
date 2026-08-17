import { isOnline } from '../../core/media';
import type { ChannelRow } from '../../db/schema';

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

/** `online` means an unclosed producer exists, not that a speaker's page is open. */
export function toPublicChannel(channel: ChannelRow) {
  return {
    slug: channel.slug,
    name: channel.name,
    online: isOnline(channel.eventId, channel.id),
  };
}
