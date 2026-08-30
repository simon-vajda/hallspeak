import { describe, expect, it } from 'vitest';
import {
  afterConnect,
  beginRebuild,
  canRollbackProducerControl,
  consumerClosed,
  consumerOpened,
  consumerPlan,
  initialMediaState,
  isCurrent,
  type MediaState,
  mayAttachConsumerTrack,
  needsRebuild,
  producerOpened,
  transportId,
  transportOpened,
} from './media-state';

const live: MediaState = {
  generation: 3,
  deviceLoaded: true,
  sendTransportId: 'send-1',
  recvTransportId: 'recv-1',
  producerId: 'p1',
  consumers: { english: 'c1' },
  rebuilding: null,
};

describe('afterConnect', () => {
  it('discards every identifier, first connection or not', () => {
    expect(afterConnect(live)).toEqual({ ...initialMediaState, generation: 4 });
    expect(afterConnect(initialMediaState)).toEqual({ ...initialMediaState, generation: 1 });
  });

  it('moves the generation on, so a reply in flight is no longer current', () => {
    const before = live.generation;
    const after = afterConnect(live);

    expect(isCurrent(after, before)).toBe(false);
    expect(isCurrent(after, after.generation)).toBe(true);
  });
});

describe('producer control rollback', () => {
  it('cannot mutate a replacement Producer when an old control fails after recovery', () => {
    const oldControl = { generation: live.generation, producerId: live.producerId };
    const recovered = producerOpened(afterConnect(live), 'p2');

    expect(canRollbackProducerControl(recovered, oldControl)).toBe(false);
    expect(
      canRollbackProducerControl(recovered, {
        generation: recovered.generation,
        producerId: recovered.producerId,
      }),
    ).toBe(true);
  });
});

describe('needsRebuild', () => {
  it('rebuilds on failed', () => {
    expect(needsRebuild('failed')).toBe(true);
  });

  it('does not rebuild on a disconnected blip that recovers on its own', () => {
    expect(needsRebuild('disconnected')).toBe(false);
    expect(needsRebuild('connected')).toBe(false);
    expect(needsRebuild('connecting')).toBe(false);
    expect(needsRebuild('new')).toBe(false);
    expect(needsRebuild('closed')).toBe(false);
  });
});

describe('beginRebuild', () => {
  it('drops the send transport and its producer, leaving the receive side alone', () => {
    const rebuilding = beginRebuild(live, 'send');

    expect(rebuilding.sendTransportId).toBeNull();
    expect(rebuilding.producerId).toBeNull();
    expect(rebuilding.recvTransportId).toBe('recv-1');
    expect(rebuilding.consumers).toEqual({ english: 'c1' });
    expect(rebuilding.rebuilding).toBe('send');
  });

  it('drops the receive transport and its consumers, leaving the send side alone', () => {
    const rebuilding = beginRebuild(live, 'recv');

    expect(rebuilding.recvTransportId).toBeNull();
    expect(rebuilding.consumers).toEqual({});
    expect(rebuilding.sendTransportId).toBe('send-1');
    expect(rebuilding.producerId).toBe('p1');
  });

  it('lets a connect arriving during the rebuild supersede it', () => {
    const rebuilding = beginRebuild(live, 'recv');
    const reconnected = afterConnect(rebuilding);

    // The rebuild's own reply is now stale and must be discarded rather than adopted.
    expect(isCurrent(reconnected, rebuilding.generation)).toBe(false);
    expect(reconnected.rebuilding).toBeNull();
  });

  it('clears the rebuilding flag when that direction’s transport comes back', () => {
    const rebuilding = beginRebuild(live, 'recv');
    const opened = transportOpened(rebuilding, 'recv', 'recv-2');

    expect(opened.rebuilding).toBeNull();
    expect(transportId(opened, 'recv')).toBe('recv-2');
  });

  it('leaves a rebuild in the other direction pending', () => {
    const rebuilding = beginRebuild(live, 'send');
    const opened = transportOpened(rebuilding, 'recv', 'recv-2');

    expect(opened.rebuilding).toBe('send');
  });
});

describe('consumerPlan', () => {
  const listening = { english: 'c1' };

  it('opens nothing while the guest has no active playback intent', () => {
    expect(consumerPlan({ consumers: {}, activeSlug: null, online: true })).toEqual({
      close: [],
      consume: null,
    });
  });

  it('consumes when a producer appears on the active channel', () => {
    expect(consumerPlan({ consumers: {}, activeSlug: 'english', online: true })).toEqual({
      close: [],
      consume: 'english',
    });
  });

  it('does not consume twice when one is already open', () => {
    expect(consumerPlan({ consumers: listening, activeSlug: 'english', online: true })).toEqual({
      close: [],
      consume: null,
    });
  });

  it('keeps the same consumer plan when an online producer mutes and resumes', () => {
    const beforeMute = consumerPlan({ consumers: listening, activeSlug: 'english', online: true });
    const whileMuted = consumerPlan({ consumers: listening, activeSlug: 'english', online: true });
    const afterResume = consumerPlan({ consumers: listening, activeSlug: 'english', online: true });

    expect(whileMuted).toEqual(beforeMute);
    expect(afterResume).toEqual(beforeMute);
    expect(whileMuted).toEqual({ close: [], consume: null });
  });

  it('closes the consumer when the interpreter goes away, and asks for nothing', () => {
    expect(consumerPlan({ consumers: listening, activeSlug: 'english', online: false })).toEqual({
      close: ['english'],
      consume: null,
    });
  });

  it('does nothing when the interpreter goes away and nothing was open', () => {
    expect(consumerPlan({ consumers: {}, activeSlug: 'english', online: false })).toEqual({
      close: [],
      consume: null,
    });
  });

  /** Closing the old consumer prevents its audio continuing after the channel switch. */
  it('closes the previous channel and opens the new one on a switch', () => {
    expect(consumerPlan({ consumers: listening, activeSlug: 'spanish', online: true })).toEqual({
      close: ['english'],
      consume: 'spanish',
    });
  });

  it('never asks for a transport rebuild on a switch', () => {
    const plan = consumerPlan({ consumers: listening, activeSlug: 'spanish', online: true });

    expect(JSON.stringify(plan)).not.toContain('transport');
  });

  it('closes a switched-away channel even when the new one is offline', () => {
    expect(consumerPlan({ consumers: listening, activeSlug: 'spanish', online: false })).toEqual({
      close: ['english'],
      consume: null,
    });
  });

  it('closes everything left over when playback intent clears', () => {
    expect(
      consumerPlan({ consumers: { english: 'c1', spanish: 'c2' }, activeSlug: null, online: true }),
    ).toEqual({ close: ['english', 'spanish'], consume: null });
  });

  it('never lists the active channel twice when it is also the one to close', () => {
    const plan = consumerPlan({ consumers: listening, activeSlug: 'english', online: false });

    expect(plan.close).toEqual(['english']);
  });
});

describe('mayAttachConsumerTrack', () => {
  it('accepts the requested track after opening the consumer makes the consume plan complete', () => {
    const opened = consumerOpened(initialMediaState, 'english', 'c1');

    expect(
      consumerPlan({ consumers: opened.consumers, activeSlug: 'english', online: true }).consume,
    ).toBeNull();
    expect(
      mayAttachConsumerTrack({
        requestedSlug: 'english',
        activeSlug: 'english',
        online: true,
        trackEnded: false,
      }),
    ).toBe(true);
  });

  it('rejects a late track after stopping, switching, going offline, or ending', () => {
    const current = { requestedSlug: 'english', online: true, trackEnded: false };

    expect(mayAttachConsumerTrack({ ...current, activeSlug: null })).toBe(false);
    expect(mayAttachConsumerTrack({ ...current, activeSlug: 'spanish' })).toBe(false);
    expect(mayAttachConsumerTrack({ ...current, activeSlug: 'english', online: false })).toBe(
      false,
    );
    expect(mayAttachConsumerTrack({ ...current, activeSlug: 'english', trackEnded: true })).toBe(
      false,
    );
  });
});

describe('consumer bookkeeping', () => {
  it('records and forgets a consumer by slug', () => {
    const opened = consumerOpened(initialMediaState, 'english', 'c9');
    expect(opened.consumers).toEqual({ english: 'c9' });

    expect(consumerClosed(opened, 'english').consumers).toEqual({});
  });

  it('forgetting a slug that is not there leaves the rest alone', () => {
    expect(consumerClosed(live, 'spanish').consumers).toEqual({ english: 'c1' });
  });

  it('tracks the producer id independently of the consumers', () => {
    const withProducer = producerOpened(initialMediaState, 'p9');

    expect(withProducer.producerId).toBe('p9');
    expect(withProducer.consumers).toEqual({});
  });
});
