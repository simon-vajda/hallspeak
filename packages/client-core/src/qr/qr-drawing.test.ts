import { describe, expect, it } from 'vitest';
import { drawQr, QR_STYLE } from './qr-drawing';

const URL = 'https://church.example/events/123456';

function subpaths(path: string) {
  return path.match(/M/g)?.length ?? 0;
}

describe('drawQr', () => {
  it('draws three eyes as frame, hole and ball', () => {
    const { path } = drawQr(URL, { style: { ...QR_STYLE, module: 'square' } });

    expect(path.startsWith('M2.2 0h2.6a2.2 2.2 0 0 1 2.2 2.2')).toBe(true);
    expect(path).toContain('M2.3 1h');
    expect(path).toContain('M2.9 2h');
  });

  it('writes plain square eyes as unit-aligned rectangles', () => {
    const { size, path } = drawQr(URL, {
      style: { frame: 'square', ball: 'square', module: 'square' },
    });

    expect(path).toContain('M0 0h7v7h-7z');
    expect(path).toContain('M1 1h5v5h-5z');
    expect(path).toContain('M2 2h3v3h-3z');
    expect(path).toContain(`M${size - 7} 0h7v7h-7z`);
    expect(path).toContain(`M0 ${size - 7}h7v7h-7z`);
  });

  it('rounds fluid modules only where no neighbour touches, and fills inside corners', () => {
    const { path } = drawQr(URL, { style: { ...QR_STYLE, module: 'fluid' } });
    const modules = path.split('M').slice(10);

    expect(modules.some((square) => square.includes('a0.25 0.25 0 0 1'))).toBe(true);
    expect(modules.some((square) => /^[\d.]+ [\d.]+h1v1h-1v-1z$/.test(square))).toBe(true);
    expect(modules.some((fillet) => /a0\.25 0\.25 0 0 [01] [-\d.]+ [-\d.]+z$/.test(fillet))).toBe(
      true,
    );
  });

  it('never prints floating-point noise', () => {
    const { path } = drawQr(URL, { logo: true, style: { ...QR_STYLE, module: 'fluid' } });

    expect(path).not.toMatch(/\d\.\d{4,}/);
  });

  it('leaves no logo gap unless asked', () => {
    expect(drawQr(URL).logo).toBeNull();
  });

  it('centres an odd-sided logo gap on the module grid', () => {
    const { size, logo } = drawQr(URL, { logo: true });

    expect(logo).not.toBeNull();
    expect((logo?.size ?? 0) % 2).toBe(1);
    expect((logo?.offset ?? 0) * 2 + (logo?.size ?? 0)).toBe(size);
    expect(Number.isInteger(logo?.offset)).toBe(true);
  });

  it('draws no module inside the logo box or the one-module margin around it', () => {
    const { path, logo } = drawQr(URL, {
      logo: true,
      style: { frame: 'square', ball: 'square', module: 'square' },
    });
    const start = (logo?.offset ?? 0) - 1;
    const end = start + (logo?.size ?? 0) + 2;
    const inside = [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].filter(([, x, y]) => {
      const col = Number(x);
      const row = Number(y);
      return col >= start && col < end && row >= start && row < end;
    });

    expect(inside).toEqual([]);
  });

  it('raises error correction to H when a logo covers data', () => {
    const plain = drawQr(URL);
    const withLogo = drawQr(URL, { logo: true });

    expect(withLogo.size).toBeGreaterThan(plain.size);
    expect(subpaths(withLogo.path)).toBeGreaterThan(9);
  });
});
