import { describe, expect, it } from '@jest/globals';
import { connectedListShape } from './shape';
import { colors, type Palette, radius, type SurfaceLevel, surfaces, withAlpha } from './tokens';
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

describe('tonal surfaces', () => {
  const ladder: SurfaceLevel[] = ['low', 'base', 'high', 'highest'];

  it('carries the same levels in both schemes, all hex', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(Object.keys(surfaces[scheme]).sort()).toEqual([...ladder].sort());

      for (const [level, value] of Object.entries(surfaces[scheme])) {
        expect(`${scheme}.${level} ${HEX.test(value)}`).toBe(`${scheme}.${level} true`);
      }
    }
  });

  it('gives every step its own value, so a step is always visible', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const values = ladder.map((level) => surfaces[scheme][level]);

      expect(new Set(values).size).toBe(ladder.length);
    }
  });
});

/**
 * WCAG relative luminance, the one measure that says whether two surfaces are told apart. It
 * lives in the test rather than beside the tokens because nothing in the app computes it: the
 * palette is fixed, and this is the check that keeps it honest.
 */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );

  const [red = 0, green = 0, blue = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Light mode is where surfaces collapse: every one of them sits within a few points of white,
 * so a step that reads clearly on a monitor disappears on a phone held in daylight. Dark mode
 * separates for free, because the same step near black is a far larger ratio. The floors are
 * therefore stated for light and checked in both schemes, which is what stops a future value
 * from being picked against a dark background and inherited by the light one.
 */
describe('surface separation', () => {
  const floors: [string, (p: Palette, s: Record<SurfaceLevel, string>) => [string, string]][] = [
    ['a card against the page', (p) => [p.card, p.background]],
    ['a tonal action against the page', (p) => [p.secondary, p.background]],
    ['a hairline against the page', (p) => [p.border, p.background]],
    ['a hairline against a card', (p) => [p.border, p.card]],
    ['a selected row against a card', (p) => [p.primaryMuted, p.card]],
    ['the first tonal step against the page', (p, s) => [s.base, p.background]],
  ];

  for (const [what, pick] of floors) {
    it(`separates ${what}`, () => {
      for (const scheme of ['light', 'dark'] as const) {
        const [a, b] = pick(colors[scheme], surfaces[scheme]);

        expect(`${scheme} ${contrast(a, b) >= 1.07}`).toBe(`${scheme} true`);
      }
    });
  }

  it('keeps each tonal step apart from the one below it', () => {
    const rungs: [SurfaceLevel, SurfaceLevel][] = [
      ['base', 'low'],
      ['high', 'base'],
      ['highest', 'high'],
    ];

    for (const scheme of ['light', 'dark'] as const) {
      for (const [step, below] of rungs) {
        const apart = contrast(surfaces[scheme][step], surfaces[scheme][below]) >= 1.03;

        expect(`${scheme} ${step} ${apart}`).toBe(`${scheme} ${step} true`);
      }
    }
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
