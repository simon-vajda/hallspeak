import type { EventRow } from '../../db/schema';

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
