import { describe, expect, it } from 'vitest';
import { FAIR_JITTER, FAIR_LOSS, gradeStats, POOR_JITTER, POOR_LOSS, summarise } from './stats';

const clean = { packetLoss: 0, jitter: 0 };

describe('gradeStats', () => {
  it('is good on a clean line', () => {
    expect(gradeStats(clean)).toBe('good');
  });

  it('grades loss at and either side of each threshold', () => {
    expect(gradeStats({ ...clean, packetLoss: FAIR_LOSS - 0.001 })).toBe('good');
    expect(gradeStats({ ...clean, packetLoss: FAIR_LOSS })).toBe('fair');
    expect(gradeStats({ ...clean, packetLoss: POOR_LOSS - 0.001 })).toBe('fair');
    expect(gradeStats({ ...clean, packetLoss: POOR_LOSS })).toBe('poor');
  });

  it('grades jitter at and either side of each threshold', () => {
    expect(gradeStats({ ...clean, jitter: FAIR_JITTER - 0.001 })).toBe('good');
    expect(gradeStats({ ...clean, jitter: FAIR_JITTER })).toBe('fair');
    expect(gradeStats({ ...clean, jitter: POOR_JITTER - 0.001 })).toBe('fair');
    expect(gradeStats({ ...clean, jitter: POOR_JITTER })).toBe('poor');
  });

  it('takes the worse of the two figures', () => {
    expect(gradeStats({ packetLoss: POOR_LOSS, jitter: 0 })).toBe('poor');
    expect(gradeStats({ packetLoss: 0, jitter: POOR_JITTER })).toBe('poor');
  });
});

describe('summarise', () => {
  it('rates loss over the interval, not since the connection began', () => {
    const previous = { packetsReceived: 900, packetsLost: 100 };
    const current = { packetsReceived: 1900, packetsLost: 100, jitter: 0.01 };

    // A bad first minute followed by a clean one reads clean, not 10% forever.
    expect(summarise(current, previous)).toEqual({ packetLoss: 0, jitter: 0.01 });
  });

  it('reports loss that is happening now', () => {
    const previous = { packetsReceived: 1000, packetsLost: 0 };
    const current = { packetsReceived: 1950, packetsLost: 50, jitter: 0.01 };

    expect(summarise(current, previous)).toEqual({ packetLoss: 0.05, jitter: 0.01 });
  });

  it('uses the first sample as its own baseline', () => {
    expect(summarise({ packetsReceived: 950, packetsLost: 50, jitter: 0.01 })).toEqual({
      packetLoss: 0.05,
      jitter: 0.01,
    });
  });

  /**
   * The speaker's remote-inbound report carries no packet count. Dividing loss by itself
   * graded every speaker's line as total loss for the rest of the broadcast.
   */
  it('prefers the fraction the remote report gives over a count it does not have', () => {
    expect(summarise({ packetsLost: 50, fractionLost: 0.01, jitter: 0.02 })).toEqual({
      packetLoss: 0.01,
      jitter: 0.02,
    });
  });

  it('gives no rate for a report with losses and no packet count at all', () => {
    expect(summarise({ packetsLost: 50, jitter: 0.02 })).toBeNull();
  });

  it('has no rate to give before anything has arrived', () => {
    expect(summarise({ packetsReceived: 0, packetsLost: 0 })).toBeNull();
    expect(summarise({})).toBeNull();
  });

  it('has no rate to give when nothing moved since the last sample', () => {
    const same = { packetsReceived: 500, packetsLost: 5 };
    expect(summarise(same, same)).toBeNull();
  });

  it('treats a missing jitter figure as none rather than as a fault', () => {
    expect(summarise({ packetsReceived: 100, packetsLost: 0 })).toEqual({
      packetLoss: 0,
      jitter: 0,
    });
  });
});
