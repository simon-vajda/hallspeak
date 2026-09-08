/**
 * Every decision the media layer makes, as pure functions. `use-media.ts` is the shell
 * that calls the browser APIs; the rules live here because the web suite renders nothing
 * and has no jsdom — logic left inside the hook is logic that cannot be tested.
 */

export type TransportDirection = 'send' | 'recv';

export type CandidateAddressFamily = 'ipv4' | 'ipv6';

/**
 * An empty ICE checklist can be diagnosed before the browser declares the transport
 * failed. Hostnames stay unknown: only literal addresses prove an address-family gap.
 */
export function candidateAddressFamily(address: string): CandidateAddressFamily | null {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
    return 'ipv4';
  }
  return address.includes(':') ? 'ipv6' : null;
}

export function hasCandidateAddressFamilyMismatch(input: {
  localAddresses: string[];
  remoteAddresses: string[];
  candidatePairCount: number;
}): boolean {
  if (input.candidatePairCount > 0) {
    return false;
  }

  // A remote candidate of unknown family is a name the browser may still resolve — and
  // through DNS64 it may resolve to a family this device does have. Diagnosing a gap the
  // server has already covered would recommend a reload nobody needs.
  const remoteFamilies = input.remoteAddresses.map(candidateAddressFamily);
  if (remoteFamilies.some((family) => family === null)) {
    return false;
  }

  const local = new Set(input.localAddresses.map(candidateAddressFamily).filter(Boolean));
  const remote = new Set(remoteFamilies);
  if (local.size === 0 || remote.size === 0) {
    return false;
  }
  return [...local].every((family) => !remote.has(family));
}

/** What the client holds for one event. Every id in it is void after a reset. */
export interface MediaState {
  /** Bumped on every socket connect, so a late reply from the previous peer can be dated. */
  generation: number;
  deviceLoaded: boolean;
  sendTransportId: string | null;
  recvTransportId: string | null;
  producerId: string | null;
  /** Consumer id by channel slug; a guest holds at most one at a time. */
  consumers: Record<string, string>;
}

export const initialMediaState: MediaState = {
  generation: 0,
  deviceLoaded: false,
  sendTransportId: null,
  recvTransportId: null,
  producerId: null,
  consumers: {},
};

/**
 * A socket connect voids everything: the server persists no media, so a reconnection and
 * a server restart are the same event from here. Applied on `connect` rather than
 * `reconnect` so the first connection takes the identical path.
 */
export function afterConnect(state: MediaState): MediaState {
  return { ...initialMediaState, generation: state.generation + 1 };
}

export type TransportConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * Chrome can stay in `new`, `connecting` or `disconnected` forever after a network
 * handoff. A deadline turns every non-terminal wait into an ICE restart; `failed` needs
 * no grace because the browser has already declared that path dead.
 */
export const ICE_RECOVERY_DELAY_MS = 5_000;

/**
 * A transport that has never connected is still gathering, and cutting its first gather
 * short restarts ICE on candidates the browser has not finished trying. A direction that
 * has connected once has no first gather left to protect, so a transport rebuilt for it
 * keeps the short deadline above.
 */
export const ICE_FIRST_GATHER_DELAY_MS = 15_000;

/**
 * Not every stuck transport is recoverable by restarting it. An ICE restart re-gathers on
 * the browser's existing peer connection, and after a network handoff that connection can
 * be holding the interfaces the device had at the moment it was created — on a phone
 * leaving Wi-Fi, cellular IPv6 addresses alone, which pair with nothing an IPv4-only
 * server announces. A new peer connection enumerates the network as it now is, which is
 * why reloading the page recovers where any number of restarts does not.
 */
export const MAX_ICE_RECOVERY_ATTEMPTS = 4;
export const ICE_RECOVERY_MAX_DELAY_MS = 30_000;

/**
 * How long to wait before the next recovery attempt, given how many have already been
 * made. `null` means arm nothing: the transport is settled, or the attempts are spent.
 */
export function iceRecoveryDelay(
  connectionState: TransportConnectionState,
  attempts = 0,
  hasEverConnected = true,
): number | null {
  if (connectionState === 'connected' || connectionState === 'closed') {
    return null;
  }
  if (attempts >= MAX_ICE_RECOVERY_ATTEMPTS) {
    return null;
  }
  if (connectionState === 'failed' && attempts === 0) {
    return 0;
  }
  if (!hasEverConnected && attempts === 0) {
    return ICE_FIRST_GATHER_DELAY_MS;
  }
  return Math.min(ICE_RECOVERY_DELAY_MS * 2 ** attempts, ICE_RECOVERY_MAX_DELAY_MS);
}

export type IceRecoveryStep = 'restart' | 'rebuild' | 'give-up';

/**
 * Restart first: it is cheap, it keeps the consumers and the producer attached, and it is
 * the right answer to an ordinary path change. Everything after that rebuilds, because a
 * restart that did not work will not work twice for the same reason.
 *
 * `failed` skips the restart entirely. The browser has already declared that path dead, and
 * a restart re-gathers on the same peer connection — which after a network handoff still
 * holds the interfaces the page had when it was created.
 */
export function iceRecoveryStep(
  attempts: number,
  connectionState: TransportConnectionState,
): IceRecoveryStep {
  if (attempts >= MAX_ICE_RECOVERY_ATTEMPTS) {
    return 'give-up';
  }
  if (connectionState === 'failed') {
    return 'rebuild';
  }
  return attempts === 0 ? 'restart' : 'rebuild';
}

/**
 * Voids one direction so the effects that own it open it again from nothing. The
 * generation bump is what dates out a reply already in flight for the transport being
 * discarded.
 */
export function beginRebuild(state: MediaState, direction: TransportDirection): MediaState {
  return {
    ...state,
    generation: state.generation + 1,
    ...(direction === 'send'
      ? { sendTransportId: null, producerId: null }
      : { recvTransportId: null, consumers: {} }),
  };
}

/**
 * A reply is adopted only if the state has not moved on since it was asked for. Transport
 * trouble and socket loss are correlated on bad Wi-Fi rather than independent, so a
 * socket connect arriving during an ICE restart must win and its late answer must be dropped.
 */
export function isCurrent(state: MediaState, generation: number): boolean {
  return state.generation === generation;
}

export interface ProducerControlIdentity {
  generation: number;
  producerId: string | null;
}

/** A failed control may roll back only the Producer that originated its request. */
export function canRollbackProducerControl(
  state: MediaState,
  request: ProducerControlIdentity,
): boolean {
  return (
    request.producerId !== null &&
    state.generation === request.generation &&
    state.producerId === request.producerId
  );
}

export function transportOpened(
  state: MediaState,
  direction: TransportDirection,
  id: string,
): MediaState {
  return {
    ...state,
    ...(direction === 'send' ? { sendTransportId: id } : { recvTransportId: id }),
  };
}

export function producerOpened(state: MediaState, producerId: string): MediaState {
  return { ...state, producerId };
}

export function producerClosed(state: MediaState): MediaState {
  return { ...state, producerId: null };
}

export function consumerOpened(state: MediaState, slug: string, consumerId: string): MediaState {
  return { ...state, consumers: { ...state.consumers, [slug]: consumerId } };
}

export function consumerClosed(state: MediaState, slug: string): MediaState {
  const { [slug]: _gone, ...rest } = state.consumers;
  return { ...state, consumers: rest };
}

/**
 * What the current situation calls for: which consumers to close, and which channel to
 * open one for. One plan rather than an event-by-event rule, because the cases overlap —
 * a channel switch is a close plus a consume, an interpreter dropping is a close alone,
 * and a bounded playback hold keeps intent without keeping a dead Consumer.
 *
 * Closing the channels the guest is no longer on is what makes a switch a consumer swap
 * on the one transport. Otherwise, the old consumer stays open and its audio keeps
 * arriving alongside the newly selected channel.
 */
export interface ConsumerPlan {
  close: string[];
  consume: string | null;
}

/** Opening a consumer completes its plan but does not cancel its pending playback handoff. */
export function mayAttachConsumerTrack(input: {
  requestedSlug: string;
  activeSlug: string | null;
  online: boolean;
  trackEnded: boolean;
}): boolean {
  return input.online && !input.trackEnded && input.requestedSlug === input.activeSlug;
}

export function consumerPlan(input: {
  consumers: Record<string, string>;
  /** Channel being played or held for automatic recovery. */
  activeSlug: string | null;
  /** A producer exists on the active channel. */
  online: boolean;
}): ConsumerPlan {
  const close = Object.keys(input.consumers).filter((slug) => slug !== input.activeSlug);
  if (input.activeSlug === null) {
    return { close, consume: null };
  }

  const open = input.consumers[input.activeSlug] !== undefined;
  if (!input.online) {
    // A hold keeps intent, not a dead consumer. A returned producer gets a fresh one.
    return { close: open ? [...close, input.activeSlug] : close, consume: null };
  }
  return { close, consume: open ? null : input.activeSlug };
}
