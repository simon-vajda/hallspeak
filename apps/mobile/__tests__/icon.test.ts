import { describe, expect, it } from '@jest/globals';
import { ICON_NAMES, icons } from '../src/components/icon';
import { colors } from '../src/theme/tokens';

const ROLES = new Set(Object.keys(colors.light));

describe('icon set', () => {
  it('carries every icon the design places', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'arrow-l',
        'check',
        'chev-l',
        'chev-r',
        'dots',
        'flash',
        'head',
        'link',
        'pause',
        'play',
        'qr',
        'qrplate',
        'star',
        'star-filled',
        'vol',
        'warn',
        'x',
      ].sort(),
    );
  });

  it('exposes exactly the named icons as data', () => {
    expect(Object.keys(icons).sort()).toEqual([...ICON_NAMES].sort());
  });

  it('gives every icon a viewBox and at least one drawable element', () => {
    for (const name of ICON_NAMES) {
      const icon = icons[name];
      expect(`${name}: ${icon.viewBox}`).toMatch(/^[a-z-]+: (\d+(\.\d+)? ){3}\d+(\.\d+)?$/);
      expect(icon.elements.length).toBeGreaterThan(0);
    }
  });

  it('keeps every drawable element geometrically complete', () => {
    for (const name of ICON_NAMES) {
      for (const element of icons[name].elements) {
        if (element.kind === 'path') {
          expect(element.d.length).toBeGreaterThan(0);
        } else if (element.kind === 'rect') {
          expect(element.width).toBeGreaterThan(0);
          expect(element.height).toBeGreaterThan(0);
        } else {
          expect(element.r).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the per-icon stroke weights the design draws', () => {
    expect(icons.qr.strokeWidth).toBe(2);
    expect(icons['star-filled'].strokeWidth).toBe(1.6);
    expect(icons.star.strokeWidth).toBe(1.8);
    expect(icons['chev-r'].strokeWidth).toBe(2.2);
    expect(icons.check.strokeWidth).toBe(2.5);
    expect(icons.x.strokeWidth).toBe(2.4);
  });

  it('keeps the filled treatments filled and the outlined ones hollow', () => {
    expect(icons['star-filled'].fill).toBe('currentColor');
    expect(icons.play.fill).toBe('currentColor');
    expect(icons.play.stroke).toBe('none');
    expect(icons.dots.fill).toBe('currentColor');
    expect(icons.star.fill).toBe('none');
    expect(icons.qr.fill).toBe('none');
  });

  it('resolves every colour through a role rather than a literal', () => {
    for (const name of ICON_NAMES) {
      const icon = icons[name];
      for (const value of [icon.fill, icon.stroke]) {
        if (value !== undefined) {
          expect(`${name}: ${value}`).toBe(
            `${name}: ${value === 'none' ? 'none' : 'currentColor'}`,
          );
        }
      }
      for (const element of icon.elements) {
        if (element.fill !== undefined) {
          expect(ROLES.has(element.fill)).toBe(true);
        }
      }
    }
  });

  it('never strokes an icon without giving it a width', () => {
    for (const name of ICON_NAMES) {
      const icon = icons[name];
      if (icon.stroke === 'currentColor') {
        expect(typeof icon.strokeWidth).toBe('number');
      }
    }
  });
});
