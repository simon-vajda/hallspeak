import { describe, expect, it } from '@jest/globals';
import { create } from 'qrcode/lib/core/qrcode';
import { qrModulesPath } from './qr-path';

function fixture(cells: number[]) {
  const size = Math.sqrt(cells.length);

  return { size, isDark: (row: number, col: number) => cells[row * size + col] === 1 };
}

function squareCount(path: string) {
  return path.match(/M/g)?.length ?? 0;
}

describe('qrModulesPath', () => {
  it('draws one unit square per dark module at its column and row', () => {
    const { size, isDark } = fixture([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    expect(qrModulesPath(size, isDark)).toBe('M0 0h1v1h-1zM1 1h1v1h-1zM2 2h1v1h-1z');
  });

  it('draws nothing for an all-light matrix', () => {
    const { size, isDark } = fixture([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    expect(qrModulesPath(size, isDark)).toBe('');
  });

  it('reads a real code: one square per dark module', () => {
    const { modules } = create('https://h.example/events/123456', { errorCorrectionLevel: 'M' });
    const dark = Array.from(modules.data).filter(Boolean).length;
    const path = qrModulesPath(modules.size, (row, col) => modules.get(row, col) === 1);

    expect(dark).toBeGreaterThan(0);
    expect(squareCount(path)).toBe(dark);
  });
});
