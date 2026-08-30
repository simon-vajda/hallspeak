/**
 * Every decision the media layer makes, as pure functions. `use-media.ts` is the shell
 * that calls the browser APIs; the rules live here because the web suite renders nothing
 * and has no jsdom — logic left inside the hook is logic that cannot be tested.
 */

export type TransportDirection = 'send' | 'recv';

/** What the client holds for one event. Every id in it is void after a reset. */
export interface MediaState {
  /** Bumped on every socket connect and on every rebuild, so a late reply can be dated. */
  generation: number;
  deviceLoaded: boolean;
  sendTransportId: string | null;
  recvTransportId: string | null;
  producerId: string | null;
  /** Consumer id by channel slug; a guest holds at most one at a time. */
  consumers: Record<string, string>;
  rebuilding: TransportDirection | null;
}

export const initialMediaState: MediaState = {
  generation: 0,
  deviceLoaded: false,
  sendTransportId: null,
  recvTransportId: null,
  producerId: null,
  consumers: {},
  rebuilding: null,
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
 * Only `failed` is terminal. `disconnected` is ICE's ordinary blip and recovers on its
 * own; rebuilding on it would tear down a connection that was about to come back.
 */
export function needsRebuild(connectionState: TransportConnectionState): boolean {
  return connectionState === 'failed';
}

export function beginRebuild(state: MediaState, direction: TransportDirection): MediaState {
  return {
    ...state,
    generation: state.generation + 1,
    rebuilding: direction,
    ...(direction === 'send'
      ? { sendTransportId: null, producerId: null }
      : { recvTransportId: null, consumers: {} }),
  };
}

/**
 * A reply is adopted only if the state has not moved on since it was asked for. Transport
 * failure and socket loss are correlated on bad Wi-Fi rather than independent, so a
 * connect arriving mid-rebuild must win and the rebuild's late answer must be dropped.
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
    rebuilding: state.rebuilding === direction ? null : state.rebuilding,
    ...(direction === 'send' ? { sendTransportId: id } : { recvTransportId: id }),
  };
}

export function transportId(state: MediaState, direction: TransportDirection): string | null {
  return direction === 'send' ? state.sendTransportId : state.recvTransportId;
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
