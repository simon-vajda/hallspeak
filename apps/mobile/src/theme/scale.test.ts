import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

/**
 * The design system, enforced rather than reviewed — the shape `components/icons.test.ts`
 * uses for the glyph set and `apps/server/src/core/boundary.test.ts` uses for its layer
 * boundary. React Native has no cascade, so nothing stops a screen from writing its own
 * `fontSize` or its own hex; only a scan like this does.
 *
 * Spacing is deliberately absent. Every value is stated at every component here, so a raw
 * number for a padding used once inside one component is clearer than an indirection, and a
 * rule against it would only produce tokens named after their own values.
 */
// Jest runs with the package as its root, and jest-expo compiles to CJS, where
// `import.meta` does not exist.
const APP_ROOT = process.cwd();

/**
 * The scanner draws over a live camera feed, which belongs to neither palette: white on the
 * picture stays white in both schemes, and a role token would follow the theme away from it.
 */
const COLOUR_EXEMPT = ['app/scan.tsx', 'src/components/scan-reticle.tsx'];

const COLOUR = /['"]#[0-9a-fA-F]{3,8}['"]|\brgba?\(/;
// `undefined` is not a value off the ramp: it clears one the ramp supplied, which is the only
// way to opt a single platform out of a step it measures differently.
const TYPE = /\b(fontSize|lineHeight|letterSpacing|fontWeight|fontFamily)\s*:(?!\s*undefined\b)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(full);
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function offenders(pattern: RegExp, exempt: string[]): string[] {
  const roots = [path.join(APP_ROOT, 'app'), path.join(APP_ROOT, 'src')];
  const skip = new Set([
    path.join(APP_ROOT, 'src/theme/tokens.ts'),
    path.join(APP_ROOT, 'src/theme/typography.ts'),
    ...exempt.map((entry) => path.join(APP_ROOT, entry)),
  ]);

  return roots
    .flatMap(sourceFiles)
    .filter((file) => !skip.has(file))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          pattern.test(line) ? [`${path.relative(APP_ROOT, file)}:${index + 1}`] : [],
        ),
    );
}

describe('design scale', () => {
  it('takes every colour from a role token', () => {
    expect(offenders(COLOUR, COLOUR_EXEMPT)).toEqual([]);
  });

  it('takes every type value from the ramp', () => {
    expect(offenders(TYPE, [])).toEqual([]);
  });
});
