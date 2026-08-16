import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// `pin` and `speaker_code` are both regenerable, so neither is a primary key: the row
// must survive its own code changing. `id` is safe to expose only to the admin, which
// is why admin routes key on it and public routes never do (spec E §2).
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pin: text('pin').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  // Disabled by default: enabling is the deliberate act that opens the doors, and it
  // doubles as both "not yet" and "over" — there is no lifecycle column.
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const channels = sqliteTable(
  'channels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // Immutable after creation. Deriving it from the editable `name` would break every
    // printed QR code the first time an admin renamed a channel.
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    speakerCode: text('speaker_code').notNull().unique(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('channels_event_id_slug_unique').on(t.eventId, t.slug)],
);

// Not `Event`: Node has a global of that name and socket/lib/validate.ts imports another
// from socket.io. `EventRow` also reads correctly — a row is not a DTO.
export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type ChannelRow = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
