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
  | { kind: 'paused' }
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
  /** This speaker muted: the producer is paused and sending nothing. */
  paused?: boolean;
  /** Present only while samples are actually moving. */
  stats: MediaStats | null;
}

export function connectionState(input: ConnectionInput): ConnectionState {
  // The socket first: without it, nothing else the client believes is current.
  if (!input.socketConnected) return { kind: 'reconnecting' };
  if (input.mediaTrouble) return { kind: 'trouble' };
  if (!input.live) return { kind: 'offline' };
  /**
   * A paused producer sends nothing, so there is nothing to grade. Graded anyway, the
   * report covering the moment of the mute reads the stopped stream's tail as loss — and
   * because no fresher report can arrive while nothing is being sent, that reading
   * freezes and the line blames the network for the speaker's own mute.
   */
  if (input.paused) return { kind: 'paused' };
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
    case 'paused':
      return 'Muted — nothing is being sent';
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

export interface StatsSample {
  /** Cumulative since the connection began, which is why a delta is needed. */
  packetsLost?: number;
  /** Present on a listener's `inbound-rtp` and absent on a speaker's `remote-inbound-rtp`. */
  packetsReceived?: number;
  jitter?: number;
  /** What the remote report gives instead of a count: loss over the last interval. */
  fractionLost?: number;
}

/**
 * Reduces a report to the two figures the grade is made of, against the previous sample.
 *
 * Both counts are cumulative, so dividing them outright yields a since-join average that
 * never recovers from a bad minute — the opposite of what a connection line is for. The
 * speaker's report is the sharper case: it carries no `packetsReceived` at all, so the
 * ratio would be loss divided by itself and read as total loss forever. `fractionLost` is
 * the figure that report actually provides, so it wins where present.
 */
export function summarise(report: StatsSample, previous?: StatsSample): MediaStats | null {
  const jitter = report.jitter ?? 0;

  if (report.fractionLost !== undefined) {
    return { packetLoss: report.fractionLost, jitter };
  }
  if (report.packetsReceived === undefined) return null;

  const received = report.packetsReceived - (previous?.packetsReceived ?? 0);
  const lost = (report.packetsLost ?? 0) - (previous?.packetsLost ?? 0);
  const total = received + lost;
  // Nothing moved since the last sample: no rate to give, rather than a fabricated zero.
  if (total <= 0) return null;
  return { packetLoss: Math.max(0, lost) / total, jitter };
}
