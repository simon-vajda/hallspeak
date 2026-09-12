import { describe, expect, it } from 'vitest';
import {
  afterConnect,
  beginRebuild,
  candidateAddressFamily,
  canRollbackProducerControl,
  consumerClosed,
  consumerOpened,
  consumerPlan,
  hasCandidateAddressFamilyMismatch,
  ICE_FIRST_GATHER_DELAY_MS,
  ICE_RECOVERY_DELAY_MS,
  ICE_RECOVERY_MAX_DELAY_MS,
  iceRecoveryDelay,
  iceRecoveryStep,
  initialMediaState,
  isCurrent,
  MAX_ICE_RECOVERY_ATTEMPTS,
  type MediaState,
  mayAttachConsumerTrack,
  producerOpened,
} from './state';

const live: MediaState = {
  generation: 3,
  deviceLoaded: true,
  sendTransportId: 'send-1',
  recvTransportId: 'recv-1',
  producerId: 'p1',
  consumers: { english: 'c1' },
};

describe('ICE candidate address families', () => {
  it('classifies only literal IPv4 and IPv6 addresses', () => {
    expect(candidateAddressFamily('87.97.83.56')).toBe('ipv4');
    expect(candidateAddressFamily('2a0a:f640:241b:7b2e::1')).toBe('ipv6');
    expect(candidateAddressFamily('candidate.local')).toBeNull();
  });

  it('detects an empty checklist split between IPv6 local and IPv4 remote candidates', () => {
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1', '2a0a:f640:1412:f620::1'],
        remoteAddresses: ['87.97.83.56'],
        candidatePairCount: 0,
      }),
    ).toBe(true);
  });

  it('withholds the diagnosis when a family overlaps, a pair exists, or addresses are unknown', () => {
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1', '192.0.0.4'],
        remoteAddresses: ['87.97.83.56'],
        candidatePairCount: 0,
      }),
    ).toBe(false);
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1'],
        remoteAddresses: ['87.97.83.56'],
        candidatePairCount: 1,
      }),
    ).toBe(false);
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['candidate.local'],
        remoteAddresses: ['87.97.83.56'],
        candidatePairCount: 0,
      }),
    ).toBe(false);
  });

  it('withholds it while the remote list still offers a name the browser may resolve', () => {
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1'],
        remoteAddresses: ['87.97.83.56', 'media.example.org'],
        candidatePairCount: 0,
      }),
    ).toBe(false);
  });

  it('still exposes a genuine gap when every remote candidate is a literal', () => {
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1'],
        remoteAddresses: ['87.97.83.56', '87.97.83.57'],
        candidatePairCount: 0,
      }),
    ).toBe(true);
  });

  it('withholds it on an empty local or remote list', () => {
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: [],
        remoteAddresses: ['87.97.83.56'],
        candidatePairCount: 0,
      }),
    ).toBe(false);
    expect(
      hasCandidateAddressFamilyMismatch({
        localAddresses: ['2a0a:f640:241b:7b2e::1'],
        remoteAddresses: [],
        candidatePairCount: 0,
      }),
    ).toBe(false);
  });
});

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

  it('leaves a first gather alone longer than it leaves a stalled transport', () => {
    expect(iceRecoveryDelay('new', 0, false)).toBe(ICE_FIRST_GATHER_DELAY_MS);
    expect(iceRecoveryDelay('connecting', 0, false)).toBe(ICE_FIRST_GATHER_DELAY_MS);
    expect(ICE_FIRST_GATHER_DELAY_MS).toBeGreaterThan(ICE_RECOVERY_DELAY_MS);
  });

  it('keeps the short deadline for a transport that connected and then stalled', () => {
    expect(iceRecoveryDelay('disconnected', 0, true)).toBe(ICE_RECOVERY_DELAY_MS);
    expect(iceRecoveryDelay('new', 0, true)).toBe(ICE_RECOVERY_DELAY_MS);
  });

  it('does not extend the deadline for a rebuilt transport on a direction that has connected', () => {
    // The fact is per direction, not per transport: a rebuild hands the direction a fresh
    // transport, and giving that one the first-gather deadline would slow the recovery.
    expect(iceRecoveryDelay('new', 1, true)).toBe(ICE_RECOVERY_DELAY_MS * 2);
  });

  it('still declares a dead path dead at once, however long the first gather may wait', () => {
    expect(iceRecoveryDelay('failed', 0, false)).toBe(0);
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
    expect(iceRecoveryDelay('new', MAX_ICE_RECOVERY_ATTEMPTS)).toBeNull();
    expect(iceRecoveryDelay('failed', MAX_ICE_RECOVERY_ATTEMPTS)).toBeNull();
    expect(iceRecoveryDelay('disconnected', MAX_ICE_RECOVERY_ATTEMPTS + 1)).toBeNull();
  });
});

describe('iceRecoveryStep', () => {
  it('restarts first, then rebuilds, then gives up', () => {
    expect(iceRecoveryStep(0, 'disconnected')).toBe('restart');
    expect(iceRecoveryStep(1, 'disconnected')).toBe('rebuild');
    expect(iceRecoveryStep(MAX_ICE_RECOVERY_ATTEMPTS - 1, 'disconnected')).toBe('rebuild');
    expect(iceRecoveryStep(MAX_ICE_RECOVERY_ATTEMPTS, 'disconnected')).toBe('give-up');
  });

  it('rebuilds a failed transport at once rather than spending a restart on it', () => {
    expect(iceRecoveryStep(0, 'failed')).toBe('rebuild');
    expect(iceRecoveryStep(1, 'failed')).toBe('rebuild');
    expect(iceRecoveryStep(MAX_ICE_RECOVERY_ATTEMPTS, 'failed')).toBe('give-up');
  });

  it('still restarts first for a transport that is merely stalled', () => {
    expect(iceRecoveryStep(0, 'new')).toBe('restart');
    expect(iceRecoveryStep(0, 'connecting')).toBe('restart');
  });
});

describe('beginRebuild', () => {
  it('voids the receive side and dates out replies in flight', () => {
    const next = beginRebuild(live, 'recv');

    expect(next.recvTransportId).toBeNull();
    expect(next.consumers).toEqual({});
    expect(next.generation).toBe(live.generation + 1);
    expect(next.sendTransportId).toBe(live.sendTransportId);
    expect(next.producerId).toBe(live.producerId);
    expect(isCurrent(next, live.generation)).toBe(false);
  });

  it('voids the send side with its producer', () => {
    const next = beginRebuild(live, 'send');

    expect(next.sendTransportId).toBeNull();
    expect(next.producerId).toBeNull();
    expect(next.recvTransportId).toBe(live.recvTransportId);
    expect(next.consumers).toBe(live.consumers);
  });
});

/**
 * A channel whose producer identity the caller has not been told — the state every plan that
 * predates producer identity is in. Each decision that turns on identity names its own ids.
 */
const unknownProducers = {
  consumedProducers: {},
  producerId: null,
  incomingProducerId: null,
};

describe('consumerPlan', () => {
  const listening = { english: 'c1' };

  it('opens nothing while the guest has no active playback intent', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: {},
        activeSlug: null,
        online: true,
      }),
    ).toEqual({
      close: [],
      consume: null,
      swap: null,
    });
  });

  it('consumes when a producer appears on the active channel', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: {},
        activeSlug: 'english',
        online: true,
      }),
    ).toEqual({
      close: [],
      consume: 'english',
      swap: null,
    });
  });

  it('does not consume twice when one is already open', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: listening,
        activeSlug: 'english',
        online: true,
      }),
    ).toEqual({
      close: [],
      consume: null,
      swap: null,
    });
  });

  it('keeps the same consumer plan when an online producer mutes and resumes', () => {
    const beforeMute = consumerPlan({
      ...unknownProducers,
      consumers: listening,
      activeSlug: 'english',
      online: true,
    });
    const whileMuted = consumerPlan({
      ...unknownProducers,
      consumers: listening,
      activeSlug: 'english',
      online: true,
    });
    const afterResume = consumerPlan({
      ...unknownProducers,
      consumers: listening,
      activeSlug: 'english',
      online: true,
    });

    expect(whileMuted).toEqual(beforeMute);
    expect(afterResume).toEqual(beforeMute);
    expect(whileMuted).toEqual({ close: [], consume: null, swap: null });
  });

  it('closes the consumer when the interpreter goes away, and asks for nothing', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: listening,
        activeSlug: 'english',
        online: false,
      }),
    ).toEqual({
      close: ['english'],
      consume: null,
      swap: null,
    });
  });

  it('does nothing when the interpreter goes away and nothing was open', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: {},
        activeSlug: 'english',
        online: false,
      }),
    ).toEqual({
      close: [],
      consume: null,
      swap: null,
    });
  });

  /** Closing the old consumer prevents its audio continuing after the channel switch. */
  it('closes the previous channel and opens the new one on a switch', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: listening,
        activeSlug: 'spanish',
        online: true,
      }),
    ).toEqual({
      close: ['english'],
      consume: 'spanish',
      swap: null,
    });
  });

  it('never asks for a transport rebuild on a switch', () => {
    const plan = consumerPlan({
      ...unknownProducers,
      consumers: listening,
      activeSlug: 'spanish',
      online: true,
    });

    expect(JSON.stringify(plan)).not.toContain('transport');
  });

  it('closes a switched-away channel even when the new one is offline', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: listening,
        activeSlug: 'spanish',
        online: false,
      }),
    ).toEqual({
      close: ['english'],
      consume: null,
      swap: null,
    });
  });

  it('closes everything left over when playback intent clears', () => {
    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: { english: 'c1', spanish: 'c2' },
        activeSlug: null,
        online: true,
      }),
    ).toEqual({ close: ['english', 'spanish'], consume: null, swap: null });
  });

  it('never lists the active channel twice when it is also the one to close', () => {
    const plan = consumerPlan({
      ...unknownProducers,
      consumers: listening,
      activeSlug: 'english',
      online: false,
    });

    expect(plan.close).toEqual(['english']);
  });
});

describe('consumerPlan across a producer change', () => {
  const listening = { english: 'c1' };
  const onP1 = { english: 'p1' };

  it('re-consumes when the channel is live under a producer this consumer is not receiving', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: true,
        producerId: 'p2',
        incomingProducerId: null,
      }),
    ).toEqual({ close: ['english'], consume: 'english', swap: null });
  });

  it('leaves a consumer alone while it receives the producer the channel names', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: true,
        producerId: 'p1',
        incomingProducerId: null,
      }),
    ).toEqual({ close: [], consume: null, swap: null });
  });

  /** Both producers transmit through the window, so nothing is closed before the new one plays. */
  it('swaps to the incoming producer without closing the one still playing', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: true,
        producerId: 'p1',
        incomingProducerId: 'p2',
      }),
    ).toEqual({
      close: [],
      consume: null,
      swap: { slug: 'english', outgoing: 'c1', producerId: 'p2' },
    });
  });

  it('asks for nothing more once the swap window closes over the producer still playing', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: true,
        producerId: 'p1',
        incomingProducerId: null,
      }),
    ).toEqual({ close: [], consume: null, swap: null });
  });

  it('asks for nothing while already receiving the incoming producer', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: { english: 'p2' },
        activeSlug: 'english',
        online: true,
        producerId: 'p1',
        incomingProducerId: 'p2',
      }),
    ).toEqual({ close: [], consume: null, swap: null });
  });

  it('keeps the hold behaviour when the channel goes offline mid-swap', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: false,
        producerId: null,
        incomingProducerId: null,
      }),
    ).toEqual({ close: ['english'], consume: null, swap: null });
  });

  it('does not re-consume against a status that names no producer', () => {
    expect(
      consumerPlan({
        consumers: listening,
        consumedProducers: onP1,
        activeSlug: 'english',
        online: true,
        producerId: null,
        incomingProducerId: null,
      }),
    ).toEqual({ close: [], consume: null, swap: null });
  });

  it('does not re-consume while the producer a consumer receives is unknown', () => {
    expect(
      consumerPlan({
        consumedProducers: {},
        consumers: listening,
        activeSlug: 'english',
        online: true,
        producerId: 'p2',
        incomingProducerId: null,
      }),
    ).toEqual({ close: [], consume: null, swap: null });
  });
});

describe('mayAttachConsumerTrack', () => {
  it('accepts the requested track after opening the consumer makes the consume plan complete', () => {
    const opened = consumerOpened(initialMediaState, 'english', 'c1');

    expect(
      consumerPlan({
        ...unknownProducers,
        consumers: opened.consumers,
        activeSlug: 'english',
        online: true,
      }).consume,
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
