import { describe, expect, it } from '@jest/globals';
import { colors, type Palette } from './tokens';
import { type TypeStep, type } from './typography';

const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

const roles = (palette: Palette) => Object.keys(palette).sort();

describe('palette', () => {
  it('carries the same roles in both schemes', () => {
    // A role present in one scheme only is a runtime `undefined` colour, which renders as
    // black in that scheme and nowhere else.
    expect(roles(colors.light)).toEqual(roles(colors.dark));
  });

  it('stores every value as hex', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [role, value] of Object.entries(colors[scheme])) {
        // The role travels in the asserted string so a failure names which token is wrong.
        expect(`${scheme}.${role} ${HEX.test(value)}`).toBe(`${scheme}.${role} true`);
      }
    }
  });

  it('keeps primary identical across schemes and live different', () => {
    expect(colors.dark.primary).toBe(colors.light.primary);
    expect(colors.dark.live).not.toBe(colors.light.live);
  });

  it('never lets teal and green collapse into one another', () => {
    expect(colors.light.primary).not.toBe(colors.light.live);
    expect(colors.dark.primary).not.toBe(colors.dark.live);
  });
});

describe('type ramp', () => {
  it('specifies every step completely', () => {
    for (const [step, style] of Object.entries(type) as [TypeStep, (typeof type)[TypeStep]][]) {
      const specified =
        typeof style.fontSize === 'number' &&
        typeof style.lineHeight === 'number' &&
        typeof style.fontWeight === 'string' &&
        style.lineHeight >= style.fontSize;

      expect(`${step} ${specified}`).toBe(`${step} true`);
    }
  });
});
