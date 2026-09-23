import { describe, expect, it } from 'vitest';
import { withheldReading } from './withheld-reading';

describe('withheldReading', () => {
  it('shows a known value whatever the settled flag says', () => {
    expect(withheldReading(4, false)).toBe('value');
    expect(withheldReading(4, true)).toBe('value');
  });

  it('shows a known zero as a value, not as withheld', () => {
    expect(withheldReading(0, true)).toBe('value');
  });

  it('is pending while an unknown value is inside its grace window', () => {
    expect(withheldReading(undefined, false)).toBe('pending');
  });

  it('is withheld once an unknown value has settled', () => {
    expect(withheldReading(undefined, true)).toBe('withheld');
  });
});
