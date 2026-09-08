import { describe, expect, it } from '@jest/globals';
import { audioActionDetail, hasNamedOutput, OUTPUT_UNKNOWN_LABEL, outputLabel } from './output';

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

  it('separates a named route from a withheld one', () => {
    expect(hasNamedOutput('Speaker')).toBe(true);
    expect(hasNamedOutput('')).toBe(false);
    expect(hasNamedOutput(null)).toBe(false);
  });
});

describe('audioActionDetail', () => {
  it('carries the route and the volume together', () => {
    expect(audioActionDetail({ route: 'Speaker', volumeLabel: '70%' })).toBe('Speaker · 70%');
  });

  it('says only the volume when the route is not known', () => {
    expect(audioActionDetail({ route: null, volumeLabel: '70%' })).toBe('70%');
  });

  it('carries a muted state through unchanged', () => {
    expect(audioActionDetail({ route: 'AirPods Pro', volumeLabel: 'Muted' })).toBe(
      'AirPods Pro · Muted',
    );
  });
});
