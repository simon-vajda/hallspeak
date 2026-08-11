/**
 * Total by construction: Handshake's regex rejects anything that is not x.y.z, so both
 * operands always split into three numbers and no parse can fail here. That is the whole
 * reason the schema is strict about prereleases — it buys a six-line comparison instead
 * of a semver dependency.
 */
export function semverLt(a: string, b: string): boolean {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
