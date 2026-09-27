/** Mirrors the `git rev-parse --short=7` prefix the local run scripts give Metro. */
export function buildEnvContents(commitHash) {
  if (!commitHash) {
    return null;
  }
  return `EXPO_PUBLIC_COMMIT=${commitHash.slice(0, 7)}\n`;
}
