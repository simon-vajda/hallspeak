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

export interface MediaStats {
  /** Fraction of packets lost, 0–1. */
  packetLoss: number;
  /** Jitter in seconds. */
  jitter: number;
}

export function gradeStats(stats: MediaStats): ConnectionGrade {
  if (stats.packetLoss >= POOR_LOSS || stats.jitter >= POOR_JITTER) {
    return 'poor';
  }
  if (stats.packetLoss >= FAIR_LOSS || stats.jitter >= FAIR_JITTER) {
    return 'fair';
  }
  return 'good';
}

/** The design's nine bars, filled in proportion to the grade. */
export const BAR_COUNT = 9;

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
  if (report.packetsReceived === undefined) {
    return null;
  }

  const received = report.packetsReceived - (previous?.packetsReceived ?? 0);
  const lost = (report.packetsLost ?? 0) - (previous?.packetsLost ?? 0);
  const total = received + lost;
  // Nothing moved since the last sample: no rate to give, rather than a fabricated zero.
  if (total <= 0) {
    return null;
  }
  return { packetLoss: Math.max(0, lost) / total, jitter };
}
