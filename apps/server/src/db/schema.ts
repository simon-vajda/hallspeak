import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A smoke table with no domain meaning: it exists to exercise generate → migrate →
// query end to end (spec §2) and is dropped when the first real tables land.
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Meta = typeof meta.$inferSelect;
export type NewMeta = typeof meta.$inferInsert;
