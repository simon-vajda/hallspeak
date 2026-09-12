import type { HandoverState } from '@linguacast/contract/socket';
import type { SocketAuth } from '../../core/access';
import { getChannelById } from '../../core/channels.service';
import { type ChannelHandover, handover } from '../../core/handover';
import * as media from '../../core/media';
import { type ClaimHolder, presence, type StudioSocket } from '../../core/presence';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/problem';

/** The subset of Socket this module needs; a real Socket satisfies it. */
export interface HandoverSocket {
  id: string;
}

/** The subset of Socket a snapshot is emitted through; a real Socket satisfies it. */
export interface HandoverTarget {
  emit(event: 'handover:state', payload: HandoverState): unknown;
}

/** The subset of Server the per-studio fan-out needs; a real Server satisfies it. */
export interface HandoverServer {
  to(room: string): HandoverTarget;
}

/**
 * Every verb derives its channel and its studio from the caller's own authorization, so
 * nothing on the wire can name a studio other than itself
 * (`docs/solutions/conventions/an-identifier-returned-to-a-client-is-not-a-capability.md`).
 * A listener has neither, and gets the same refusal producing would earn it.
 */
function studioOf(socket: HandoverSocket, auth: SocketAuth): StudioSocket {
  const { eventId, speakerChannelId, studioSession } = auth;
  if (speakerChannelId === null || studioSession === null) {
    throw new AppError('not_speaker', 'This session may not broadcast on this channel.');
  }
  return { eventId, channelId: speakerChannelId, sessionId: studioSession, socketId: socket.id };
}

/** A studio in pre-flight asking whoever is live to hand the channel over. */
export function requestHandover(socket: HandoverSocket, auth: SocketAuth): Record<string, never> {
  const studio = studioOf(socket, auth);
  switch (handover.request(studio)) {
    case 'accepted':
      return {};
    case 'no_claim':
      throw new AppError('not_live', 'Nobody is broadcasting on this channel right now.');
    case 'holds_claim':
      throw new AppError('already_live', 'You are already broadcasting on this channel.');
    case 'in_progress':
      throw new AppError('handover_in_progress', 'A handover is already under way here.');
  }
}

/** The waiting studio withdrawing, which clears both prompts and both countdowns. */
export function cancelHandover(socket: HandoverSocket, auth: SocketAuth): Record<string, never> {
  const studio = studioOf(socket, auth);
  if (handover.cancel(studio) === 'not_waiting') {
    throw new AppError('not_waiting', 'You are not waiting for this channel.');
  }
  return {};
}

/** The live interpreter handing over at once, rather than sitting out the countdown. */
export function confirmHandover(socket: HandoverSocket, auth: SocketAuth): Record<string, never> {
  const studio = studioOf(socket, auth);
  const standing = media.channelStatus(auth.eventId, studio.channelId).producerId;
  switch (handover.confirm(studio, standing)) {
    case 'accepted':
      return {};
    case 'not_holder':
      throw new AppError('not_holder', 'You are not broadcasting on this channel.');
    case 'nothing_pending':
      throw new AppError('nothing_pending', 'Nobody is waiting for this channel.');
  }
}

/** The waiting studio forcing the swap once the countdown has run out. */
export function takeOverHandover(socket: HandoverSocket, auth: SocketAuth): Record<string, never> {
  const studio = studioOf(socket, auth);
  const standing = media.channelStatus(auth.eventId, studio.channelId).producerId;
  switch (handover.takeOver(studio, standing)) {
    case 'accepted':
      return {};
    case 'not_waiting':
      throw new AppError('not_waiting', 'You are not waiting for this channel.');
    case 'too_soon':
      throw new AppError('too_soon', 'The interpreter on air still has time to respond.');
  }
}

/**
 * `live` is the claim holder with nothing of its own in flight — a pending request from a
 * colleague is something it is being asked about, not something it is doing.
 */
function roleOf(
  sessionId: string,
  claim: ClaimHolder | undefined,
  view: ChannelHandover | null,
): HandoverState['role'] {
  if (view?.grant) {
    if (view.grant.sessionId === sessionId) {
      return 'granted';
    }
    if (view.grant.fromSessionId === sessionId) {
      return 'handing-over';
    }
  } else if (view?.request?.sessionId === sessionId) {
    return 'waiting';
  }
  return claim?.sessionId === sessionId ? 'live' : 'bystander';
}

/**
 * Built per studio rather than per channel: two studios on one channel see the same facts
 * from opposite sides, and the countdown and the right to force a swap are the server's
 * answers rather than arithmetic a client could get wrong.
 */
export function handoverStateFor(studio: StudioSocket, slug: string): HandoverState {
  const { channelId, sessionId } = studio;
  const claim = presence.claimOf(channelId);
  const view = handover.view(channelId);

  return {
    slug,
    holder: claim === undefined ? 'none' : claim.sessionId === sessionId ? 'self' : 'other',
    role: roleOf(sessionId, claim, view),
    pending: view !== null,
    remainingMs: handover.remainingMs(channelId),
    canTakeOver: handover.canTakeOver(channelId, sessionId),
  };
}

/**
 * Sent unconditionally on connect, like the report tally: a studio that has heard nothing
 * cannot tell an idle channel from one it has no reading of, and the difference decides
 * whether Go live is offered at all.
 */
export function sendHandoverState(db: Db, target: HandoverTarget, studio: StudioSocket): void {
  // `socket.data` carries no slug, so the wire's identifier is read back off the row.
  const channel = getChannelById(db, studio.channelId);
  if (!channel) {
    return;
  }
  target.emit('handover:state', handoverStateFor(studio, channel.slug));
}

/**
 * Every studio on the channel, holder or not: a claim moving is news to the studio that
 * lost it, the one that gained it, and everyone waiting behind them.
 */
export function broadcastHandoverState(db: Db, io: HandoverServer, channelId: number): void {
  const studios = presence.studios(channelId);
  if (studios.length === 0) {
    return;
  }
  const channel = getChannelById(db, channelId);
  if (!channel) {
    return;
  }
  for (const studio of studios) {
    io.to(studio.socketId).emit('handover:state', handoverStateFor(studio, channel.slug));
  }
}
