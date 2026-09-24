/** One unit square per dark module, in module coordinates: the `Svg` viewBox scales it. */
export function qrModulesPath(size: number, isDark: (row: number, col: number) => boolean) {
  let path = '';

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (isDark(row, col)) {
        path += `M${col} ${row}h1v1h-1z`;
      }
    }
  }

  return path;
}
