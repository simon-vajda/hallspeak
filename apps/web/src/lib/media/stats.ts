/**
 * The pure half of the connection line: WebRTC statistics in, one named grade out, on the
 * same shape as `lib/audio/level.ts`. Thresholds are named constants so the copy and the
 * bars agree on where each boundary sits.
 */

/** Above this, loss is audible as dropouts rather than smoothed over by Opus FEC. */
export const POOR_LOSS = 0.05;
export const FAIR_LOSS = 0.02;

/** Jitter in seconds, as WebRTC reports it. Beyond this the buffer cannot hide it. */
export const POOR_JITTER = 0.1;
export const FAIR_JITTER = 0.03;

export type ConnectionGrade = 'good' | 'fair' | 'poor';

/**
 * The whole situation, not just the media path. `offline` is nobody being live and is not
 * a fault; `trouble` is the media path failing under a socket that is fine; `reconnecting`
 * is the socket itself. Keeping them apart is the point — only one is about a person, and
 * none of them is the guest's to fix.
 */
export type ConnectionState =
  | { kind: 'idle' }
  | { kind: 'reconnecting' }
  | { kind: 'trouble' }
  | { kind: 'offline' }
  | { kind: 'flowing'; grade: ConnectionGrade };

export interface MediaStats {
  /** Fraction of packets lost, 0–1. */
  packetLoss: number;
  /** Jitter in seconds. */
  jitter: number;
}

export function gradeStats(stats: MediaStats): ConnectionGrade {
  if (stats.packetLoss >= POOR_LOSS || stats.jitter >= POOR_JITTER) return 'poor';
  if (stats.packetLoss >= FAIR_LOSS || stats.jitter >= FAIR_JITTER) return 'fair';
  return 'good';
}

export interface ConnectionInput {
  socketConnected: boolean;
  /** The transport's own connection state has failed, or a rebuild is under way. */
  mediaTrouble: boolean;
  /** A producer exists on the channel in question. */
  live: boolean;
  /** Present only while samples are actually moving. */
  stats: MediaStats | null;
}

export function connectionState(input: ConnectionInput): ConnectionState {
  // The socket first: without it, nothing else the client believes is current.
  if (!input.socketConnected) return { kind: 'reconnecting' };
  if (input.mediaTrouble) return { kind: 'trouble' };
  if (!input.live) return { kind: 'offline' };
  if (!input.stats) return { kind: 'idle' };
  return { kind: 'flowing', grade: gradeStats(input.stats) };
}

/** The design's nine bars, filled in proportion to the grade. */
export const BAR_COUNT = 9;

export function filledBars(state: ConnectionState): number {
  if (state.kind !== 'flowing') return 0;
  if (state.grade === 'good') return BAR_COUNT;
  return state.grade === 'fair' ? 6 : 3;
}

/**
 * The text equivalent, which is also what a screen reader gets: replacing this line with
 * bars alone would remove any notice of precisely the states this adds.
 */
export function connectionLabel(state: ConnectionState): string {
  switch (state.kind) {
    case 'reconnecting':
      return 'Reconnecting…';
    case 'trouble':
      return 'Audio connection re-establishing';
    case 'offline':
      return 'Waiting for the interpreter';
    case 'idle':
      return 'Connected';
    case 'flowing':
      return state.grade === 'good'
        ? 'Good connection'
        : state.grade === 'fair'
          ? 'Connection is a little unsteady'
          : 'Poor connection';
  }
}

/**
 * Reduces the raw report to the two figures that matter. Loss is cumulative in WebRTC, so
 * it is turned into a rate against the packets received; a sample with nothing received
 * yet has no rate to give.
 */
export function summarise(report: {
  packetsLost?: number;
  packetsReceived?: number;
  jitter?: number;
}): MediaStats | null {
  const received = report.packetsReceived ?? 0;
  const lost = report.packetsLost ?? 0;
  const total = received + lost;
  if (total === 0) return null;
  return { packetLoss: lost / total, jitter: report.jitter ?? 0 };
}
