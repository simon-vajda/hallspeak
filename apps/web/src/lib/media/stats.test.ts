import { describe, expect, it } from 'vitest';
import {
  BAR_COUNT,
  connectionLabel,
  connectionState,
  FAIR_JITTER,
  FAIR_LOSS,
  filledBars,
  gradeStats,
  POOR_JITTER,
  POOR_LOSS,
  summarise,
} from './stats';

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

describe('connectionState', () => {
  const flowing = { socketConnected: true, mediaTrouble: false, live: true, stats: clean };

  it('is flowing and graded while samples are moving', () => {
    expect(connectionState(flowing)).toEqual({ kind: 'flowing', grade: 'good' });
  });

  it('grades a failed transport as trouble even though the socket is fine', () => {
    expect(connectionState({ ...flowing, mediaTrouble: true })).toEqual({ kind: 'trouble' });
  });

  it('grades a lost socket distinctly from a failed transport', () => {
    const socketDown = connectionState({ ...flowing, socketConnected: false });

    expect(socketDown).toEqual({ kind: 'reconnecting' });
    expect(socketDown).not.toEqual(connectionState({ ...flowing, mediaTrouble: true }));
  });

  it('puts the socket first, because nothing else is current without it', () => {
    expect(connectionState({ ...flowing, socketConnected: false, mediaTrouble: true })).toEqual({
      kind: 'reconnecting',
    });
  });

  it('does not report trouble when nobody is live on a healthy transport', () => {
    const offline = connectionState({ ...flowing, live: false, stats: null });

    expect(offline).toEqual({ kind: 'offline' });
    expect(offline.kind).not.toBe('trouble');
  });

  it('is idle when live but no samples have arrived yet', () => {
    expect(connectionState({ ...flowing, stats: null })).toEqual({ kind: 'idle' });
  });
});

describe('the rendered line', () => {
  it('fills every bar on a good connection and none when nothing flows', () => {
    expect(filledBars({ kind: 'flowing', grade: 'good' })).toBe(BAR_COUNT);
    expect(filledBars({ kind: 'offline' })).toBe(0);
    expect(filledBars({ kind: 'trouble' })).toBe(0);
  });

  it('fills fewer bars as the grade drops', () => {
    const good = filledBars({ kind: 'flowing', grade: 'good' });
    const fair = filledBars({ kind: 'flowing', grade: 'fair' });
    const poor = filledBars({ kind: 'flowing', grade: 'poor' });

    expect(good).toBeGreaterThan(fair);
    expect(fair).toBeGreaterThan(poor);
    expect(poor).toBeGreaterThan(0);
  });

  it('gives every state a text equivalent, and keeps the three apart', () => {
    const labels = [
      connectionLabel({ kind: 'reconnecting' }),
      connectionLabel({ kind: 'trouble' }),
      connectionLabel({ kind: 'offline' }),
    ];

    expect(new Set(labels).size).toBe(3);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });

  it('keeps the media-trouble line about the audio, not about the interpreter', () => {
    expect(connectionLabel({ kind: 'trouble' })).not.toMatch(/interpreter/i);
    expect(connectionLabel({ kind: 'offline' })).toMatch(/interpreter/i);
  });
});

describe('summarise', () => {
  it('turns cumulative loss into a rate against everything that arrived', () => {
    expect(summarise({ packetsReceived: 950, packetsLost: 50, jitter: 0.01 })).toEqual({
      packetLoss: 0.05,
      jitter: 0.01,
    });
  });

  it('has no rate to give before anything has arrived', () => {
    expect(summarise({ packetsReceived: 0, packetsLost: 0 })).toBeNull();
    expect(summarise({})).toBeNull();
  });

  it('treats a missing jitter figure as none rather than as a fault', () => {
    expect(summarise({ packetsReceived: 100, packetsLost: 0 })).toEqual({
      packetLoss: 0,
      jitter: 0,
    });
  });
});
