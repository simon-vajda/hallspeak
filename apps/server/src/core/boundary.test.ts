import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// core/ owns the domain and the engines under it; hono and socket.io are how clients
// reach it, not something it reaches for. Convention alone would not hold once
// mediasoup lands, so this is a tripwire, the way the foreign_keys pragma is.
const FORBIDDEN = [
  /^hono$/,
  /^hono\//,
  /^@hono\//,
  /^socket\.io$/,
  // A sideways reach into a sibling layer is the same violation by another route,
  // and the one a package-name-only scan would miss.
  /\.\.\/http\//,
  /\.\.\/socket\//,
];

// Matches the specifier alone, so prose naming Hono in a comment does not trip it.
const SPECIFIER =
  /(?:^|[\s;{(])(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function specifiersOf(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
}

describe('core/ imports no transport', () => {
  // Resolved against this file rather than the working directory, matching how
  // db/migrate.ts resolves its own folder.
  const root = import.meta.dirname;
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name));

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(root, file), file]))('%s', (name, file) => {
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      const forbidden = FORBIDDEN.find((pattern) => pattern.test(specifier));

      expect(
        forbidden,
        `core/${name} imports '${specifier}'. core/ may not import a client transport or reach sideways into http/ or socket/.`,
      ).toBeUndefined();
    }
  });
});
