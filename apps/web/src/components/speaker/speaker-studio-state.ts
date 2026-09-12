/**
 * The speaker studio's decisions, kept out of the component so they can be tested without a
 * browser.
 */

import type { AnchoredHandover } from '@linguacast/client-core/socket';
import { SocketError } from '@linguacast/contract/socket';

/**
 * `live` is derived from a producer existing, never set optimistically on the click: the
 * screen must not say On air before the server has one.
 *
 * `handing-over` is still transmitting: the outgoing interpreter keeps the air until the
 * incoming producer exists, so nothing goes silent in the swap.
 *
 * `displaced` is terminal rather than a shade of muted because another session owns the
 * speaker link and this one must not reclaim it. A handover is not displacement: it ends
 * with this studio back in pre-flight, free to ask for the channel again.
 */
export type BroadcastState =
  | 'pre-flight'
  | 'connecting'
  | 'live'
  | 'muted'
  | 'handing-over'
  | 'displaced';

export interface BroadcastInput {
  goLivePressed: boolean;
  hasProducer: boolean;
  isMuted: boolean;
  handingOver: boolean;
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
  if (input.handingOver) {
    return 'handing-over';
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
  handoverKnown: boolean;
  handover: AnchoredHandover | undefined;
}

export type ReconnectAction =
  | { type: 'none' }
  | { type: 're-produce'; paused: boolean }
  | { type: 'to-pre-flight' };

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

  const snapshot = input.handoverKnown ? input.handover : undefined;

  // A grant is the server handing this studio the channel, whether or not it was ever live
  // here. It produces unmuted: a handover carries no mute state across, so the incoming
  // interpreter starts where a Go live would have put them.
  if (snapshot?.role === 'granted') {
    return { type: 're-produce', paused: false };
  }
  if (!input.goLivePressed) {
    return { type: 'none' };
  }
  // The claim moved while this studio was away. Re-producing here is the alternation the
  // negotiated handover exists to prevent, so the studio goes back to pre-flight instead
  // and asks for the channel like any other newcomer.
  if (snapshot?.holder === 'other') {
    return { type: 'to-pre-flight' };
  }
  if (input.lastEnd?.reason !== 'dropped') {
    return { type: 'none' };
  }
  return { type: 're-produce', paused: input.lastEnd.muted };
}

/** The handover snapshot as the studio holds it, with the flag saying it has been heard. */
export interface HandoverSnapshot {
  handoverKnown: boolean;
  handover: AnchoredHandover | undefined;
}

export interface PreflightInput extends HandoverSnapshot {
  linkUp: boolean;
}

/**
 * What the pre-flight screen offers. `unknown` is the screen withholding rather than
 * guessing, and must never collapse into `go-live`: an interpreter told to go live over a
 * colleague who is on air would cut them off with no negotiation at all.
 */
export type PreflightAction =
  | { type: 'go-live' }
  | { type: 'ready' }
  | { type: 'waiting'; expiresAt: number | null }
  | { type: 'take-over' }
  | { type: 'pending-elsewhere' }
  | { type: 'unknown' };

export function preflightAction(input: PreflightInput): PreflightAction {
  if (!input.linkUp || !input.handoverKnown || input.handover === undefined) {
    return { type: 'unknown' };
  }

  const { holder, role, pending, canTakeOver, expiresAt } = input.handover;

  // A grant is this studio's turn: it presses Go live like anyone holding the channel.
  if (role === 'granted' || holder !== 'other') {
    return { type: 'go-live' };
  }
  if (role === 'waiting') {
    // `canTakeOver` is the server's answer, never re-derived from `expiresAt`: a client
    // counting to zero on its own clock would offer a takeover the server refuses.
    return canTakeOver ? { type: 'take-over' } : { type: 'waiting', expiresAt };
  }
  return pending ? { type: 'pending-elsewhere' } : { type: 'ready' };
}

export interface HandingOverInput extends HandoverSnapshot {
  /** This studio's own confirm or forced departure, before the server has answered. */
  confirmed: boolean;
}

/**
 * The server owns the swap, so its snapshot decides as soon as one exists; the local press
 * only covers the gap before the first answer, where withholding would flick the screen
 * back to a live it is about to leave.
 */
export function isHandingOver(input: HandingOverInput): boolean {
  if (!input.handoverKnown || input.handover === undefined) {
    return input.confirmed;
  }
  return input.handover.holder === 'self' && input.handover.role === 'handing-over';
}

/**
 * The produce refusal that means the claim is no longer this studio's. The server
 * authorises a produce on the claim rather than on the handshake, so a studio that lost
 * the channel while away learns it here and returns to pre-flight.
 */
export const CLAIM_MOVED = 'channel_taken';

export function isClaimMoved(error: unknown): boolean {
  return error instanceof SocketError && error.code === CLAIM_MOVED;
}
