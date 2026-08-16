import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { isUniqueViolation } from '../db/errors';
import { type EventRow, events } from '../db/schema';
import { AppError } from '../lib/problem';
import { generatePin } from './codes';

export interface EventInput {
  name: string;
  description?: string | null;
  enabled?: boolean;
}
export type EventPatch = Partial<EventInput>;

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

// --- admin reads ------------------------------------------------------------

export function listEvents(db: Db): EventRow[] {
  return db.select().from(events).orderBy(asc(events.name)).all();
}

export function getEventById(db: Db, id: number): EventRow | undefined {
  return db.select().from(events).where(eq(events.id, id)).get();
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
