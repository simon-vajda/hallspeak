import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing';
import {
  createEvent,
  deleteEvent,
  findEnabledEventByPin,
  listEvents,
  regeneratePin,
  updateEvent,
} from './events.service';

describe('createEvent', () => {
  it('starts disabled with a six-digit pin', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday Service' });

      expect(event.pin).toMatch(/^\d{6}$/);
      expect(event.enabled).toBe(false);
      expect(event.description).toBe(null);
    } finally {
      cleanup();
    }
  });

  // The retry is invisible in production and untestable without seeding the collision.
  it('retries past a pin collision', () => {
    const { db, cleanup } = createTestDb();
    try {
      createEvent(db, { name: 'First' }, () => '424242');
      const pins = ['424242', '424243'];
      let call = 0;

      const second = createEvent(db, { name: 'Second' }, () => pins[call++] ?? '000000');

      expect(second.pin).toBe('424243');
      expect(call).toBe(2);
    } finally {
      cleanup();
    }
  });
});

describe('public lookups', () => {
  it('does not find a disabled event', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday' });

      expect(findEnabledEventByPin(db, event.pin)).toBeUndefined();

      updateEvent(db, event.id, { enabled: true });

      expect(findEnabledEventByPin(db, event.pin)?.id).toBe(event.id);
    } finally {
      cleanup();
    }
  });
});

describe('mutations', () => {
  it('regenerates a pin, invalidating the old one', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday', enabled: true });
      const oldPin = event.pin;

      const updated = regeneratePin(db, event.id);

      expect(updated?.pin).not.toBe(oldPin);
      expect(findEnabledEventByPin(db, oldPin)).toBeUndefined();
      expect(findEnabledEventByPin(db, updated?.pin ?? '')?.id).toBe(event.id);
    } finally {
      cleanup();
    }
  });

  it('bumps updatedAt on a patch', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday' });
      db.$client.exec(`UPDATE events SET updated_at = 0 WHERE id = ${event.id}`);

      const updated = updateEvent(db, event.id, { name: 'Sunday Service' });

      expect(updated?.updatedAt).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it('reports a missing row rather than throwing', () => {
    const { db, cleanup } = createTestDb();
    try {
      expect(updateEvent(db, 999, { name: 'x' })).toBeUndefined();
      expect(deleteEvent(db, 999)).toBe(false);
      expect(listEvents(db)).toEqual([]);
    } finally {
      cleanup();
    }
  });
});
