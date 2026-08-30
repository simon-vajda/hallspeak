import type { SocketStatus } from '@/lib/socket-state';
import { BAR_COUNT, type ConnectionGrade, gradeStats, type MediaStats } from './stats';

export type MediaHealth = 'idle' | 'connecting' | 'connected' | 'trouble';

export type LinkState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'reconnecting' }
  | { kind: 'connected' }
  | { kind: 'flowing'; grade: ConnectionGrade }
  | { kind: 'lost' };

export interface LinkStateInput {
  socketStatus: SocketStatus;
  hasConnected: boolean;
  mediaHealth: MediaHealth;
  stats: MediaStats | null;
  /**
   * Whether this screen is holding, or trying to hold, a media session at all. False for a
   * guest who has not asked for audio — including every guest on a channel with no producer.
   * There is no second leg to report on then, and a line reporting the socket alone would be
   * answering a question nobody asked.
   */
  mediaWanted: boolean;
}

/** Resolves both connection legs once, with terminal and rebuilding states taking priority. */
export function resolveLinkState(input: LinkStateInput): LinkState {
  if (input.socketStatus === 'error') {
    return { kind: 'lost' };
  }
  // Only once the socket is up: before that, silence would mean "not yet" rather than
  // "nothing to say", and `isLinkUp` would read the difference as a working link.
  if (!input.mediaWanted && input.socketStatus === 'connected') {
    return { kind: 'idle' };
  }
  if (
    !input.hasConnected &&
    (input.socketStatus !== 'connected' || input.mediaHealth === 'connecting')
  ) {
    return { kind: 'connecting' };
  }
  if (
    input.hasConnected &&
    (input.socketStatus !== 'connected' || input.mediaHealth === 'trouble')
  ) {
    return { kind: 'reconnecting' };
  }
  if (
    input.socketStatus === 'connected' &&
    input.mediaHealth === 'connected' &&
    input.stats !== null
  ) {
    return { kind: 'flowing', grade: gradeStats(input.stats) };
  }
  return { kind: 'connected' };
}

/**
 * Whether the link is working, as opposed to being reported on. `idle` counts: it is only
 * reachable under a connected socket, and it means no media session was asked for — not that
 * anything is broken. Callers gate broadcast copy on this, never on the line's own vocabulary.
 */
export function isLinkUp(state: LinkState): boolean {
  return state.kind === 'idle' || state.kind === 'connected' || state.kind === 'flowing';
}

/** Design's nine bars, filled only while current samples are flowing. */
export function filledBars(state: LinkState): number {
  if (state.kind !== 'flowing') {
    return 0;
  }
  if (state.grade === 'good') {
    return BAR_COUNT;
  }
  return state.grade === 'fair' ? 6 : 3;
}

export function linkLabel(state: LinkState): string {
  switch (state.kind) {
    // The line renders nothing in this state, so the empty string is never displayed.
    case 'idle':
      return '';
    case 'connecting':
      return 'Connecting…';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'connected':
      return 'Connected';
    case 'flowing':
      return state.grade === 'good'
        ? 'Good connection'
        : state.grade === 'fair'
          ? 'A little unsteady'
          : 'Poor connection';
    case 'lost':
      return 'Connection lost';
  }
}
