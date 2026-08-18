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

export type MediaAction =
  | { type: 'none' }
  | { type: 'close-consumer'; consumerId: string }
  | { type: 'consume'; slug: string }
  | { type: 'close-consumer-then-consume'; consumerId: string; slug: string };

/**
 * Switching channel closes the current consumer and opens another on the same transport.
 * Never a transport rebuild — that is what one router per event buys, and renegotiating
 * here would put a gap in the audio exactly where a listener notices it.
 */
export function switchChannel(state: MediaState, from: string | null, to: string): MediaAction {
  const current = from === null ? undefined : state.consumers[from];
  if (from === to && current) return { type: 'none' };
  if (!current) return { type: 'consume', slug: to };
  return { type: 'close-consumer-then-consume', consumerId: current, slug: to };
}

/**
 * Arming is the guest's one gesture and survives everything after it. What a producer's
 * arrival should trigger is a consume — or nothing, if one is already open for that slug.
 */
export function onProducerChange(
  state: MediaState,
  input: { armedSlug: string | null; online: boolean },
): MediaAction {
  if (input.armedSlug === null) return { type: 'none' };
  const consumerId = state.consumers[input.armedSlug];

  if (input.online) {
    return consumerId ? { type: 'none' } : { type: 'consume', slug: input.armedSlug };
  }
  return consumerId ? { type: 'close-consumer', consumerId } : { type: 'none' };
}
