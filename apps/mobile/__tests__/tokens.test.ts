import { describe, expect, it } from '@jest/globals';
import { colors, elevation, radius, spacing, typography } from '@/theme/tokens';

const HEX = /^#[0-9A-F]{6}$/;
const HEX_ALPHA = /^#[0-9A-F]{8}$/;

describe('colour sets', () => {
  it('holds the same token names in both themes', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('carries no oklch() or color-mix() expression through the port', () => {
    for (const set of [colors.light, colors.dark]) {
      for (const [name, value] of Object.entries(set)) {
        expect(`${name}: ${value}`).toMatch(
          new RegExp(`^${name}: (${HEX.source.slice(1, -1)}|${HEX_ALPHA.source.slice(1, -1)})$`),
        );
      }
    }
  });

  it('emits the translucent hover overlays as eight-digit hex', () => {
    expect(colors.light.hoverOverlay).toMatch(HEX_ALPHA);
    expect(colors.light.hoverOverlayStrong).toMatch(HEX_ALPHA);
    expect(colors.dark.hoverOverlay).toMatch(HEX_ALPHA);
    expect(colors.dark.hoverOverlayStrong).toMatch(HEX_ALPHA);
  });

  it('rebuilds the two uncommented dark tokens on the dark destructive hue', () => {
    expect(colors.dark.destructiveMuted).toBe('#512C28');
    expect(colors.dark.destructiveBorder).toBe('#703C35');
  });

  it('resolves an alias token to the value it repeated', () => {
    expect(colors.light.muted).toBe(colors.light.secondary);
    expect(colors.light.ring).toBe(colors.light.primary);
    expect(colors.dark.popover).toBe(colors.dark.card);
    expect(colors.dark.input).toBe(colors.dark.border);
  });

  it('keeps pressable teal and audio green apart in both themes', () => {
    expect(colors.light.primary).not.toBe(colors.light.live);
    expect(colors.dark.primary).not.toBe(colors.dark.live);
  });

  it('keeps primary identical across themes and live distinct', () => {
    expect(colors.dark.primary).toBe(colors.light.primary);
    expect(colors.dark.live).not.toBe(colors.light.live);
  });
});

describe('type ramp', () => {
  it('states size, line height and weight for the default body step', () => {
    expect(typography.body).toEqual({ fontSize: 14, lineHeight: 21, fontWeight: 400 });
  });

  it('carries the tracking the design fixes on a screen title', () => {
    expect(typography.screen).toEqual({
      fontSize: 30,
      lineHeight: 31.8,
      fontWeight: 600,
      letterSpacing: -1.05,
    });
  });

  it('tracks every PIN step out', () => {
    expect(typography.pin.letterSpacing).toBeCloseTo(0.84);
    expect(typography.pinLg.letterSpacing).toBeCloseTo(1.12);
  });

  it('gives every step a positive size and line height', () => {
    for (const step of Object.values(typography)) {
      expect(step.fontSize).toBeGreaterThan(0);
      expect(step.lineHeight).toBeGreaterThanOrEqual(step.fontSize);
    }
  });
});

describe('layout scales', () => {
  it('converts rem to pixels at the 16px base', () => {
    expect(spacing.gutter).toBe(26);
    expect(spacing.panel).toBe(22);
    expect(spacing.touch).toBe(44);
    expect(radius.lg).toBe(20);
    expect(radius.full).toBe(999);
  });

  it('derives the radius scale from the one base value', () => {
    expect(radius.sm).toBe(12);
    expect(radius.md).toBe(16);
    expect(radius.xl).toBe(28);
  });

  it('tints the go-live shadow with primary rather than a literal', () => {
    expect(elevation.goLive.shadowColor).toBe(colors.light.primary);
  });
});
