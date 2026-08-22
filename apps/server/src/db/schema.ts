import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// `pin` and `speaker_code` are regenerable, so neither is a primary key: the row must
// survive its own code changing. Admin routes key on `id`; public routes never do.
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pin: text('pin').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  // Disabled by default. `enabled` doubles as both "not yet" and "over", so there is no
  // lifecycle column.
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
    // Immutable after creation: deriving it from the editable `name` would break every
    // printed QR code on the first rename.
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    speakerCode: text('speaker_code').notNull().unique(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('channels_event_id_slug_unique').on(t.eventId, t.slug)],
);

// Keyed on the token's digest, never the token: a database read — a backup, a copied
// file — must not yield live sessions. There is one account, so a session has nothing to
// be associated with beyond its own lifetime.
export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

// Not `Event`: Node has a global of that name and socket/lib/validate.ts imports another
// from socket.io.
export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type ChannelRow = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
