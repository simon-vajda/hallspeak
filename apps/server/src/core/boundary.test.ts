import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// core/ owns the domain and the engines under it; hono and socket.io are how clients
// reach it, not something it reaches for. Convention alone would not hold once
// mediasoup lands, so this is a tripwire, the way the foreign_keys pragma is.
//
// It catches DIRECT imports only. A core/ module reaching a transport through an
// intermediate module still passes — proving that needs a module graph, and a module
// graph needs a dependency this repo does not have.
const FORBIDDEN_PACKAGES = [
  /^hono$/,
  /^hono\//,
  /^@hono\//,
  /^socket\.io$/,
  /^socket\.io\//,
  /^@socket\.io\//,
];

// The sibling layers core/ may not reach into. db/ and lib/ are fine — core/ owns its
// engines and shares the transport-free helpers.
const SIBLING_LAYERS = ['http', 'socket'];

const CORE_ROOT = import.meta.dirname;
const SRC_ROOT = path.dirname(CORE_ROOT);

// Comments come out before anything is matched, so prose naming Hono cannot trip the
// scan and, more importantly, cannot sit between an `export` and a later `from` clause
// and be read as one statement. Both strips are anchored to a line start so a `/*` or
// `//` inside a string literal cannot swallow the import that follows it.
function stripComments(source: string): string {
  return source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

// Each alternative is anchored to the start of a line because an import statement can
// only appear at the top level. A bare `import 'hono'` has no `from` clause and needs
// its own alternative — without it a side-effect import of a transport reads as clean.
// The clause before `from` is bounded to the characters a real one can contain, so it
// spans a multi-line `import type { … }` but cannot run past the end of a statement
// and capture a quoted specifier out of unrelated code further down the file.
const SPECIFIER =
  /^\s*import\s*['"]([^'"]+)['"]|^\s*(?:import|export)\b[^;'"()=]*?\bfrom\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function specifiersOf(source: string): string[] {
  return [...stripComments(source).matchAll(SPECIFIER)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '',
  );
}

/**
 * Why `specifier` is not allowed in a module under `fromDir`, or undefined when it is.
 * Relative specifiers are resolved rather than matched as text: that is what catches
 * the barrel form `../socket` — this repo's own import idiom — as well as
 * `../socket/lib/rooms` and any depth of `../../`.
 */
function violationOf(fromDir: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(fromDir, specifier);
    const layer = SIBLING_LAYERS.find((name) => {
      const dir = path.join(SRC_ROOT, name);
      return resolved === dir || resolved.startsWith(dir + path.sep);
    });
    return layer ? `reaches sideways into ${layer}/` : undefined;
  }

  return FORBIDDEN_PACKAGES.some((p) => p.test(specifier))
    ? 'imports a client transport'
    : undefined;
}

describe('core/ imports no transport', () => {
  // Resolved against this file rather than the working directory, matching how
  // db/migrate.ts resolves its own folder.
  // Every file under core/ is bound by the rule, tests included — except this one,
  // whose fixtures below are violation snippets held as strings. A scanner cannot tell
  // `require('hono')` in a fixture from the real thing, and the `the guard itself`
  // block is what covers this file in exchange.
  const files = readdirSync(CORE_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|mts|cts)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => file !== import.meta.filename);

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(CORE_ROOT, file), file]))('%s', (name, file) => {
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      const violation = violationOf(path.dirname(file), specifier);

      expect(violation, `core/${name} ${violation}: '${specifier}'`).toBeUndefined();
    }
  });
});

// Without these the suite proves only that core/ is currently clean — an edit that
// broke the matcher outright would leave every file passing and the guard silently
// guarding nothing.
describe('the guard itself', () => {
  it.each([
    ["import { Hono } from 'hono';", 'hono'],
    ["import 'hono';", 'hono'],
    ["import type { Env } from 'hono/types';", 'hono/types'],
    ["import { OpenAPIHono } from '@hono/zod-openapi';", '@hono/zod-openapi'],
    ["import type { Server } from 'socket.io';", 'socket.io'],
    ["import { Adapter } from 'socket.io/dist/socket';", 'socket.io/dist/socket'],
    ["import { createAdapter } from '@socket.io/redis-adapter';", '@socket.io/redis-adapter'],
    ["const { Hono } = require('hono');", 'hono'],
    ["export const x = () => import('socket.io');", 'socket.io'],
    ["export { eventRoom } from '../socket';", '../socket'],
    ["import { eventRoom } from '../socket/lib/rooms';", '../socket/lib/rooms'],
  ])('rejects %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(violationOf(CORE_ROOT, specifier)).toBeDefined();
  });

  // The depth that matters next: core/media/ is where mediasoup lands, and from there
  // a sideways reach is spelled ../../http/ rather than ../http/.
  it('rejects a sideways reach from a nested core/ directory', () => {
    const fromDir = path.join(CORE_ROOT, 'media');

    expect(violationOf(fromDir, '../../http/mappers/events.mapper')).toBeDefined();
    expect(violationOf(fromDir, '../../socket')).toBeDefined();
    expect(violationOf(fromDir, '../presence')).toBeUndefined();
  });

  it.each([
    ["import { eq } from 'drizzle-orm';", 'drizzle-orm'],
    ["import Database from 'better-sqlite3';", 'better-sqlite3'],
    ["import { createDb } from '../db/client';", '../db/client'],
    ["import { semverLt } from '../lib/semver';", '../lib/semver'],
    ["import { generatePin } from './codes';", './codes'],
  ])('allows %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(violationOf(CORE_ROOT, specifier)).toBeUndefined();
  });

  it('does not read prose as an import', () => {
    const prose = [
      '// This logic was reorganized from the old signal module.',
      'export function foo() {}',
      "// Notes exported by the http layer, using data from 'socket.io' docs.",
      'export const x = 1;',
    ].join('\n');

    expect(specifiersOf(prose)).toEqual([]);
  });
});
