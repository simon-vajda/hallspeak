import { describe, expect, it } from '@jest/globals';
import {
  audioStatus,
  normalizeVolume,
  OUTPUT_UNKNOWN_LABEL,
  outputLabel,
  volumeLabel,
} from './system-audio';

describe('outputLabel', () => {
  it('names the route the platform gave', () => {
    expect(outputLabel('AirPods Pro')).toBe('AirPods Pro');
  });

  it('withholds rather than fabricating one when the platform reported nothing', () => {
    expect(outputLabel(null)).toBe(OUTPUT_UNKNOWN_LABEL);
    expect(outputLabel(undefined)).toBe(OUTPUT_UNKNOWN_LABEL);
    expect(outputLabel('')).toBe(OUTPUT_UNKNOWN_LABEL);
    expect(outputLabel('   ')).toBe(OUTPUT_UNKNOWN_LABEL);
  });
});

describe('normalizeVolume', () => {
  it('keeps a level the platform reported', () => {
    expect(normalizeVolume(40)).toBe(40);
  });

  it('clamps a reading outside the range', () => {
    expect(normalizeVolume(140)).toBe(100);
    expect(normalizeVolume(-5)).toBe(0);
  });

  it('reads a missing or non-numeric level as silence rather than inventing one', () => {
    expect(normalizeVolume(undefined)).toBe(0);
    expect(normalizeVolume('loud')).toBe(0);
    expect(normalizeVolume(Number.NaN)).toBe(0);
  });

  it('rounds, because the line has no room for a fraction', () => {
    expect(volumeLabel(39.6)).toBe('40%');
  });
});

describe('audioStatus', () => {
  it('names the route and the level together', () => {
    expect(audioStatus({ route: 'EDIFIER WH950NB', volume: 70 })).toBe('EDIFIER WH950NB · 70%');
  });

  it('says only the level when the platform named no route', () => {
    expect(audioStatus({ route: null, volume: 70 })).toBe('70%');
    expect(audioStatus({ route: '   ', volume: 70 })).toBe('70%');
  });

  it('states a muted device as a level rather than as a word this app chose', () => {
    expect(audioStatus({ route: 'Speaker', volume: 0 })).toBe('Speaker · 0%');
  });
});
