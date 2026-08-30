import type { SocketStatus } from '@/lib/socket-state';
import { BAR_COUNT, type ConnectionGrade, gradeStats, type MediaStats } from './stats';

export type MediaHealth = 'idle' | 'connecting' | 'connected' | 'trouble';

export type LinkState =
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
}

/** Resolves both connection legs once, with terminal and rebuilding states taking priority. */
export function resolveLinkState(input: LinkStateInput): LinkState {
  if (input.socketStatus === 'error') {
    return { kind: 'lost' };
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
