import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { type ChannelRow, channels, type EventRow, events } from '../db/schema';
import { AppError } from '../lib/problem';
import { generatePin, generateSpeakerCode } from './codes';

export interface EventInput {
  name: string;
  description?: string | null;
  enabled?: boolean;
}
export type EventPatch = Partial<EventInput>;

export interface ChannelInput {
  slug: string;
  name: string;
  enabled?: boolean;
}
export interface ChannelPatch {
  name?: string;
  enabled?: boolean;
}

/** better-sqlite3 surfaces constraint failures as SQLITE_CONSTRAINT_* on `code`. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code.startsWith('SQLITE_CONSTRAINT')
  );
}

// --- public lookups ---------------------------------------------------------
// Every one of these filters on `enabled`. A disabled row must be indistinguishable
// from a missing one at the boundary (spec E §5), which is easiest to guarantee when
// the query itself cannot return it.

export function findEnabledEventByPin(db: Db, pin: string): EventRow | undefined {
  return db
    .select()
    .from(events)
    .where(and(eq(events.pin, pin), eq(events.enabled, true)))
    .get();
}

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

export function listEvents(db: Db): EventRow[] {
  return db.select().from(events).orderBy(asc(events.name)).all();
}

export function getEventById(db: Db, id: number): EventRow | undefined {
  return db.select().from(events).where(eq(events.id, id)).get();
}

export function listChannels(db: Db, eventId: number): ChannelRow[] {
  return db
    .select()
    .from(channels)
    .where(eq(channels.eventId, eventId))
    .orderBy(asc(channels.name))
    .all();
}

// --- writes -----------------------------------------------------------------

const CODE_ATTEMPTS = 10;

/**
 * `generate` is a parameter purely so the collision retry is testable: six digits
 * collide about once in a million and there is no other way to reach that branch.
 */
export function createEvent(
  db: Db,
  input: EventInput,
  generate: () => string = generatePin,
): EventRow {
  const now = Date.now();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      return db
        .insert(events)
        .values({
          pin: generate(),
          name: input.name,
          description: input.description ?? null,
          enabled: input.enabled ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new AppError('pin_unavailable', 'Could not allocate a unique PIN.');
}

export function updateEvent(db: Db, id: number, patch: EventPatch): EventRow | undefined {
  return db
    .update(events)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(events.id, id))
    .returning()
    .get();
}

export function deleteEvent(db: Db, id: number): boolean {
  return db.delete(events).where(eq(events.id, id)).returning().all().length > 0;
}

export function regeneratePin(db: Db, id: number): EventRow | undefined {
  if (!getEventById(db, id)) return undefined;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      return db
        .update(events)
        .set({ pin: generatePin(), updatedAt: Date.now() })
        .where(eq(events.id, id))
        .returning()
        .get();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new AppError('pin_unavailable', 'Could not allocate a unique PIN.');
}

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

/** `slug` is deliberately absent from ChannelPatch — it is immutable (spec E §2). */
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
