/**
 * The speaker studio's decisions, kept out of the component so they can be tested without a
 * browser.
 */

/**
 * `live` is derived from a producer existing, never set optimistically on the click: the
 * screen must not say On air before the server has one.
 *
 * `displaced` is terminal rather than a shade of muted because another session owns the
 * speaker link and this one must not reclaim it.
 */
export type BroadcastState = 'pre-flight' | 'connecting' | 'live' | 'muted' | 'displaced';

export interface BroadcastInput {
  goLivePressed: boolean;
  hasProducer: boolean;
  isMuted: boolean;
  displaced: boolean;
}

export function broadcastState(input: BroadcastInput): BroadcastState {
  // A takeover ends this session outright; nothing below it can apply.
  if (input.displaced) {
    return 'displaced';
  }
  if (!input.goLivePressed) {
    return 'pre-flight';
  }
  if (!input.hasProducer) {
    return 'connecting';
  }
  return input.isMuted ? 'muted' : 'live';
}

/** Only this state has audio reaching anyone; every claim in the copy hangs off it. */
export function isBroadcasting(state: BroadcastState): boolean {
  return state === 'live';
}

/**
 * How long a broadcast survives a link the client cannot re-establish. Socket.IO retries
 * forever, so without a deadline the studio sits on `Reconnecting…` with nothing behind it;
 * the same 30 seconds the listener holds for a dropped producer.
 */
export const LINK_DROP_GRACE_MS = 30_000;

/** Why the last broadcast stopped, including the state a dropped producer must restore. */
export type BroadcastEnd = { reason: 'deliberate' } | { reason: 'dropped'; muted: boolean };

export interface ReconnectInput {
  goLivePressed: boolean;
  lastEnd: BroadcastEnd | null;
  displaced: boolean;
}

export type ReconnectAction = { type: 'none' } | { type: 're-produce'; paused: boolean };

/**
 * After an involuntary drop the client rebuilds and restores the producer's mute state.
 * After a deliberate end it does nothing — a broadcast somebody chose to stop must not
 * restart itself because the Wi-Fi blinked.
 *
 * A drop must be positively recorded, never inferred from the absence of one. Treating
 * `lastEnd: null` as "not deliberate, so re-produce" fires on the very first Go live —
 * before the producer exists there is nothing to tell the two apart — and the interpreter
 * lands muted on the one path that has to just work.
 */
export function onReconnect(input: ReconnectInput): ReconnectAction {
  if (input.displaced) {
    return { type: 'none' };
  }
  if (!input.goLivePressed) {
    return { type: 'none' };
  }
  if (input.lastEnd?.reason !== 'dropped') {
    return { type: 'none' };
  }
  return { type: 're-produce', paused: input.lastEnd.muted };
}
