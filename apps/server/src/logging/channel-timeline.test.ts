import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '../core/notifications';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'trace', LOG_DIR: '' },
}));
vi.mock('../env', () => ({ env: envMock }));

const { useLogDestination } = await import('../lib/log');
const { createChannelTimeline } = await import('./channel-timeline');

const SLUGS = new Map([
  [11, 'de'],
  [12, 'fr'],
]);

let records: Record<string, unknown>[];

beforeEach(() => {
  records = [];
  useLogDestination({
    write(chunk: string) {
      records.push(JSON.parse(chunk));
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const messages = () => records.map((record) => String(record.msg));
const timeline = () => createChannelTimeline((channelId) => SLUGS.get(channelId));

const onAir = (channelId = 11, slug = 'de'): Notification => ({
  type: 'producer-opened',
  eventId: 3,
  channelId,
  slug,
});
const offAir = (channelId = 11, slug = 'de'): Notification => ({
  type: 'producer-closed',
  eventId: 3,
  channelId,
  slug,
  reason: 'ended',
});
const listeners = (count: number, channelId = 11, slug = 'de'): Notification => ({
  type: 'listeners-changed',
  eventId: 3,
  channelId,
  slug,
  count,
});
const claim = (sessionId: string | null, channelId = 11): Notification => ({
  type: 'claim-changed',
  eventId: 3,
  channelId,
  sessionId,
  socketId: sessionId === null ? null : 'sock_1',
});

describe('the channel timeline', () => {
  it('writes one record each for going on air and going off air, named by event and slug', () => {
    const apply = timeline();

    apply(onAir());
    apply(offAir());

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      subsystem: 'channel',
      level: 30,
      msg: 'channel on air',
      eventId: 3,
      channelId: 11,
      slug: 'de',
      transition: 'on-air',
      count: 0,
    });
    expect(records[1]).toMatchObject({
      msg: 'channel off air',
      eventId: 3,
      slug: 'de',
      transition: 'off-air',
      reason: 'ended',
    });
  });

  it('writes nothing of its own for listener changes between the boundaries', () => {
    const apply = timeline();
    apply(onAir());
    records.length = 0;

    for (let i = 1; i <= 100; i++) {
      apply(listeners(i));
    }

    expect(records).toHaveLength(0);
  });

  it('reports the peak reached during the session, not the final count', () => {
    const apply = timeline();
    apply(onAir());
    apply(listeners(40));
    apply(listeners(120));
    apply(listeners(3));

    apply(offAir());

    expect(records.at(-1)).toMatchObject({ count: 3, peak: 120 });
  });

  it("does not let a second broadcast inherit the first one's peak", () => {
    const apply = timeline();
    apply(onAir());
    apply(listeners(120));
    apply(listeners(0));
    apply(offAir());
    records.length = 0;

    apply(onAir());
    apply(listeners(5));
    apply(offAir());

    expect(records.at(-1)).toMatchObject({ peak: 5 });
  });

  it('carries the peak through a handover rather than restarting it', () => {
    const apply = timeline();
    apply(onAir());
    apply(listeners(120));

    // What a swap publishes: the incoming producer, then its promotion, with no close in
    // between, because listeners experience one continuous broadcast. The count dips
    // between the two — a listener that has moved is invisible until it is recounted
    // against the producer it moved to.
    apply(onAir());
    apply(listeners(3));
    apply(claim('ssn_second'));
    apply(onAir());
    apply(listeners(118));
    apply(offAir());

    expect(records.at(-1)).toMatchObject({ count: 118, peak: 120 });
  });

  it('says a channel went on air once across a handover, not once per producer', () => {
    const apply = timeline();
    apply(onAir());
    apply(onAir());
    apply(onAir());

    expect(messages().filter((message) => message === 'channel on air')).toHaveLength(1);
  });

  it('still opens a new broadcast after the channel has gone off air', () => {
    const apply = timeline();
    apply(onAir());
    apply(offAir());
    records.length = 0;

    apply(onAir());

    expect(messages().filter((message) => message === 'channel on air')).toHaveLength(1);
  });

  it('counts listeners already present when a channel goes on air', () => {
    const apply = timeline();
    apply(listeners(7));

    apply(onAir());

    expect(records[0]).toMatchObject({ transition: 'on-air', count: 7 });
  });

  it('tracks two channels of one event independently', () => {
    const apply = timeline();
    apply(onAir(11, 'de'));
    apply(onAir(12, 'fr'));
    apply(listeners(90, 11, 'de'));
    apply(listeners(4, 12, 'fr'));
    records.length = 0;

    apply(offAir(12, 'fr'));
    apply(offAir(11, 'de'));

    expect(records[0]).toMatchObject({ slug: 'fr', reason: 'ended', count: 4, peak: 4 });
    expect(records[1]).toMatchObject({ slug: 'de', reason: 'ended', count: 90, peak: 90 });
  });

  it('puts a handover on the same timeline', () => {
    const apply = timeline();

    apply(claim('ssn_first'));
    apply(claim('ssn_second'));
    apply(claim(null));

    expect(records.map((record) => record.transition)).toEqual([
      'rights-taken',
      'rights-handed',
      'rights-released',
    ]);
  });

  it('names a reconnected studio as a rebind rather than a handover', () => {
    const apply = timeline();

    apply(claim('ssn_first'));
    apply(claim('ssn_first'));

    expect(records[1]).toMatchObject({ transition: 'rights-rebound' });
  });

  it('never writes the studio session that identifies the holder', () => {
    const apply = timeline();

    apply(claim('ssn_first'));
    apply(claim('ssn_second'));

    const written = JSON.stringify(records);
    expect(written).not.toContain('ssn_first');
    expect(written).not.toContain('ssn_second');
    expect(written).not.toContain('sock_1');
  });

  it('resolves the slug of a claim change, which does not carry one', () => {
    const apply = timeline();

    apply(claim('ssn_first', 12));

    expect(records[0]).toMatchObject({ eventId: 3, channelId: 12, slug: 'fr' });
  });

  it('names a vanished channel by its id rather than relabelling it', () => {
    const apply = timeline();

    apply(claim('ssn_first', 99));

    expect(records[0]).toMatchObject({ eventId: 3, channelId: 99 });
    expect(records[0]).not.toHaveProperty('slug');
  });

  it('carries no listener address, because none reaches it', () => {
    const apply = timeline();
    apply(onAir());
    apply(listeners(3));
    apply(offAir());

    expect(JSON.stringify(records)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('writes at info with a timestamp, so an operator sees it without raising the level', () => {
    const apply = timeline();

    apply(onAir());

    expect(records[0]?.level).toBe(30);
    expect(String(records[0]?.time)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('ignores the notifications it has no line for', () => {
    const apply = timeline();

    apply({ type: 'producer-paused', eventId: 3, channelId: 11, slug: 'de' });
    apply({ type: 'handover-changed', eventId: 3, channelId: 11 });
    apply({ type: 'room-evicted', eventId: 3, reason: 'worker_died' });

    expect(records).toHaveLength(0);
  });
});
