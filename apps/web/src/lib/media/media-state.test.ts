import { describe, expect, it } from 'vitest';
import {
  afterConnect,
  canRollbackProducerControl,
  consumerClosed,
  consumerOpened,
  consumerPlan,
  ICE_RECOVERY_DELAY_MS,
  ICE_RECOVERY_MAX_DELAY_MS,
  iceRecoveryDelay,
  initialMediaState,
  isCurrent,
  MAX_ICE_RESTARTS,
  type MediaState,
  mayAttachConsumerTrack,
  producerOpened,
} from './media-state';

const live: MediaState = {
  generation: 3,
  deviceLoaded: true,
  sendTransportId: 'send-1',
  recvTransportId: 'recv-1',
  producerId: 'p1',
  consumers: { english: 'c1' },
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

describe('ICE recovery', () => {
  it('restarts ICE when setup or a handoff stays unhealthy past the grace period', () => {
    expect(iceRecoveryDelay('new')).toBe(ICE_RECOVERY_DELAY_MS);
    expect(iceRecoveryDelay('connecting')).toBe(ICE_RECOVERY_DELAY_MS);
    expect(iceRecoveryDelay('disconnected')).toBe(ICE_RECOVERY_DELAY_MS);
    expect(iceRecoveryDelay('failed')).toBe(0);
    expect(iceRecoveryDelay('failed', 1)).toBe(ICE_RECOVERY_DELAY_MS * 2);
  });

  it('does not arm recovery for a connected or closed transport', () => {
    expect(iceRecoveryDelay('connected')).toBeNull();
    expect(iceRecoveryDelay('connected', 1)).toBeNull();
    expect(iceRecoveryDelay('closed')).toBeNull();
    expect(iceRecoveryDelay('closed', 1)).toBeNull();
  });

  it('backs off between attempts and caps the wait', () => {
    expect(iceRecoveryDelay('new', 1)).toBe(ICE_RECOVERY_DELAY_MS * 2);
    expect(iceRecoveryDelay('new', 2)).toBe(ICE_RECOVERY_DELAY_MS * 4);
    expect(iceRecoveryDelay('new', 3)).toBe(ICE_RECOVERY_MAX_DELAY_MS);
  });

  it('gives up once the attempts are spent, whatever the state', () => {
    expect(iceRecoveryDelay('new', MAX_ICE_RESTARTS)).toBeNull();
    expect(iceRecoveryDelay('failed', MAX_ICE_RESTARTS)).toBeNull();
    expect(iceRecoveryDelay('disconnected', MAX_ICE_RESTARTS + 1)).toBeNull();
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
