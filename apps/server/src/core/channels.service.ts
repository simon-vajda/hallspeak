import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { type ChannelRow, channels } from '../db/schema';
import { generateSpeakerCode } from './codes';

export interface ChannelInput {
  slug: string;
  name: string;
  enabled?: boolean;
}
export interface ChannelPatch {
  name?: string;
  enabled?: boolean;
}

// --- public lookups ---------------------------------------------------------
// All filter on `enabled`: a disabled row must be indistinguishable from a missing one at
// the boundary, which is easiest to guarantee when the query cannot return it.

export function listEnabledChannels(db: Db, eventId: number): ChannelRow[] {
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.eventId, eventId), eq(channels.enabled, true)))
    .orderBy(asc(channels.name))
    .all();
}

export function findEnabledChannelBySlug(
  db: Db,
  eventId: number,
  slug: string,
): ChannelRow | undefined {
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.eventId, eventId), eq(channels.slug, slug), eq(channels.enabled, true)))
    .get();
}

export function findEnabledChannelBySpeakerCode(db: Db, code: string): ChannelRow | undefined {
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.speakerCode, code), eq(channels.enabled, true)))
    .get();
}

export function getChannelById(db: Db, id: number): ChannelRow | undefined {
  return db.select().from(channels).where(eq(channels.id, id)).get();
}

// --- admin reads ------------------------------------------------------------

export function listChannels(db: Db, eventId: number): ChannelRow[] {
  return db
    .select()
    .from(channels)
    .where(eq(channels.eventId, eventId))
    .orderBy(asc(channels.name))
    .all();
}

// --- writes -----------------------------------------------------------------

export function createChannel(
  db: Db,
  eventId: number,
  input: ChannelInput,
  generate: () => string = generateSpeakerCode,
): ChannelRow {
  const now = Date.now();
  return db
    .insert(channels)
    .values({
      eventId,
      slug: input.slug,
      name: input.name,
      speakerCode: generate(),
      enabled: input.enabled ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

/** No `slug` in ChannelPatch: it is immutable after creation. */
export function updateChannel(db: Db, id: number, patch: ChannelPatch): ChannelRow | undefined {
  return db
    .update(channels)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(channels.id, id))
    .returning()
    .get();
}

export function deleteChannel(db: Db, id: number): boolean {
  return db.delete(channels).where(eq(channels.id, id)).returning().all().length > 0;
}

export function regenerateSpeakerCode(db: Db, id: number): ChannelRow | undefined {
  if (!getChannelById(db, id)) return undefined;
  return db
    .update(channels)
    .set({ speakerCode: generateSpeakerCode(), updatedAt: Date.now() })
    .where(eq(channels.id, id))
    .returning()
    .get();
}
