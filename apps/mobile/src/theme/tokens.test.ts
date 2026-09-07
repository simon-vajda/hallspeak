import { describe, expect, it } from '@jest/globals';
import { connectedListShape } from './shape';
import { colors, type Palette, radius, withAlpha } from './tokens';
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

describe('withAlpha', () => {
  it('appends the alpha byte React Native reads, clamping out of range', () => {
    expect(withAlpha('#3AD3A6', 1)).toBe('#3AD3A6ff');
    expect(withAlpha('#3AD3A6', 0)).toBe('#3AD3A600');
    expect(withAlpha('#3AD3A6', 0.14)).toBe('#3AD3A624');
    expect(withAlpha('#3AD3A6', 2)).toBe('#3AD3A6ff');
    expect(withAlpha('#3AD3A6', -1)).toBe('#3AD3A600');
  });
});

describe('connectedListShape', () => {
  it('rounds only the outer corners of the group', () => {
    const [first, middle, last] = [0, 1, 2].map((index) => connectedListShape(index, 3));

    expect(first?.borderTopLeftRadius).toBe(radius.xl);
    expect(first?.borderBottomLeftRadius).toBe(6);
    expect(middle?.borderTopLeftRadius).toBe(6);
    expect(middle?.borderBottomRightRadius).toBe(6);
    expect(last?.borderBottomRightRadius).toBe(radius.xl);
    expect(last?.borderTopRightRadius).toBe(6);
  });

  it('rounds a lone row on both ends', () => {
    const only = connectedListShape(0, 1);

    expect(only.borderTopLeftRadius).toBe(radius.xl);
    expect(only.borderBottomRightRadius).toBe(radius.xl);
  });
});
