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

// Comments come out before anything is matched, so prose naming Hono cannot trip the
// scan and, more importantly, cannot sit between an `export` and a later `from` clause
// and be read as one statement. The `[^:]` guard keeps a `//` inside a URL literal.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

// Each alternative is anchored to the start of a line because an import statement can
// only appear at the top level. A bare `import 'hono'` has no `from` clause and needs
// its own alternative — without it a side-effect import of a transport reads as clean.
const SPECIFIER =
  /^\s*import\s*['"]([^'"]+)['"]|^\s*(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function specifiersOf(source: string): string[] {
  return [...stripComments(source).matchAll(SPECIFIER)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '',
  );
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
