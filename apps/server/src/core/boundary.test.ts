import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// docs/solutions/architecture-patterns/guard-a-layer-boundary-with-a-self-testing-import-scan.md
// Direct imports only: a transport reached through an intermediate module still passes.
const FORBIDDEN_PACKAGES = [
  /^hono$/,
  /^hono\//,
  /^@hono\//,
  /^socket\.io$/,
  /^socket\.io\//,
  /^@socket\.io\//,
];

// db/ and lib/ are absent deliberately: core/ owns its engines and shares the
// transport-free helpers.
const SIBLING_LAYERS = ['http', 'socket'];

const CORE_ROOT = import.meta.dirname;
const SRC_ROOT = path.dirname(CORE_ROOT);

// Prose must not sit between an `export` and a later `from` clause and be read as one
// statement. Anchored to a line start so a `//` in a string cannot swallow the next import.
function stripComments(source: string): string {
  return source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

// Anchored to a line start: an import statement is top-level only. A bare `import 'hono'`
// has no `from` clause and needs its own alternative. The clause before `from` is bounded
// to the characters a real one can contain, so it spans a multi-line import but cannot
// run past the end of the statement.
const SPECIFIER =
  /^\s*import\s*['"]([^'"]+)['"]|^\s*(?:import|export)\b[^;'"()=]*?\bfrom\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function specifiersOf(source: string): string[] {
  return [...stripComments(source).matchAll(SPECIFIER)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '',
  );
}

/**
 * Why `specifier` is not allowed in a module under `fromDir`, or undefined when it is.
 * Relative specifiers are resolved, not matched as text, so `../socket` and any depth of
 * `../../` are caught alike.
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
  // Every file under core/ is bound by the rule, tests included, except this one: its
  // fixtures below are violation snippets held as strings.
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

// Without these, an edit that broke the matcher outright would leave every file passing.
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

  // core/media/ is where mediasoup lands, and from there a sideways reach is ../../http/.
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
