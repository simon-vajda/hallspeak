import { presence } from '../../core/presence';
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

/** `online` comes from the presence registry — see the placeholder note there. */
export function toPublicChannel(channel: ChannelRow) {
  return { slug: channel.slug, name: channel.name, online: presence.isOnline(channel.id) };
}
