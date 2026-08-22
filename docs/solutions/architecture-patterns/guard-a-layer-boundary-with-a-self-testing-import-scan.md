---
title: Guard a layer boundary with an import scan that tests itself
date: 2026-08-16
category: architecture-patterns
module: apps/server
problem_type: architecture_pattern
component: testing_framework
severity: high
applies_when:
  - "A restructure introduces a layering rule that only a convention would enforce"
  - "Writing a lint-like test that scans source text instead of a module graph"
  - "A tripwire test only ever asserts the codebase is currently clean"
  - "A layer must forbid some dependencies while deliberately allowing others"
tags:
  - architecture
  - layering
  - boundary-test
  - tripwire
  - regex
  - vitest
  - static-analysis
related_components:
  - tooling
---

# Guard a layer boundary with an import scan that tests itself

## Context

The `apps/server/src` restructure split the server by dependency direction: `core/` is the
domain, `http/` and `socket/` are the two transports that drive it. The rule that makes the
split worth anything is negative — `core/` must not import `hono`, `@hono/*` or `socket.io`,
and must not reach sideways into `../http/` or `../socket/`. It must still be free to import
`drizzle-orm`, `better-sqlite3` and (later) `mediasoup`, because those are engines `core/`
owns rather than transports clients reach it through.

Nothing in TypeScript expresses that. A rule stated only in `AGENTS.md` decays: the very
misfiling the restructure started from was `semver.ts` sitting under the socket layer purely
because its one caller lived there. So the rule got a test —
`apps/server/src/core/boundary.test.ts`, a text scan over every `.ts` under `core/` that fails
on a forbidden import specifier and names both the file and the specifier. It landed on the
`refactor/server-core-transport-split` branch, in three rounds referred to below as rounds 1–3.

The guard was porous at every stage, and each stage's holes were invisible from that stage's
own green run:

- **At plan time (session history)**, the guard was specified as a scan for three package
  specifiers — `hono`, `@hono/*`, `socket.io`. Plan review caught that this form would have
  reported green on the plan's *own* violation: `semver.ts` was slated for the socket layer
  while its only consumer moved to `core/`, a `core/ → socket/` edge on day one. The
  relative-path half of the rule was added before a line was written.
- **At implementation (session history)**, the rule was verified with temporary probe files
  that were deleted afterwards, leaving nothing committed that exercised the matcher.
- **In two later review rounds**, six more evasions surfaced — and the last of them was the
  absence of any committed evidence that the matcher still worked at all.

That is the learning: a text-scan guard is worth writing, and the first draft of one is
reliably porous in ways its own green test run cannot reveal.

## Guidance

**Write the guard, but assume the matcher is wrong until it is pinned by fixtures.**

A boundary scan has two independently fallible halves — the matcher that finds import
specifiers, and the predicate that decides whether a specifier is allowed. A suite that only
iterates real files exercises neither: it proves the tree is currently clean, and it goes on
passing if an edit breaks the matcher outright. The fix is a second `describe` block of
violation and permission fixtures held as string literals:

```ts
describe('the guard itself', () => {
  it.each([
    ["import { Hono } from 'hono';", 'hono'],
    ["import 'hono';", 'hono'],
    ["import type { Env } from 'hono/types';", 'hono/types'],
    ["const { Hono } = require('hono');", 'hono'],
    ["export const x = () => import('socket.io');", 'socket.io'],
    ["export { eventRoom } from '../socket';", '../socket'],
  ])('rejects %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(violationOf(CORE_ROOT, specifier)).toBeDefined();
  });

  it.each([
    ["import { eq } from 'drizzle-orm';", 'drizzle-orm'],
    ["import { semverLt } from '../lib/semver';", '../lib/semver'],
  ])('allows %j', (source, specifier) => {
    expect(specifiersOf(source)).toContain(specifier);
    expect(violationOf(CORE_ROOT, specifier)).toBeUndefined();
  });
});
```

Each fixture asserts twice on purpose: that the matcher *extracted* the specifier at all, and
that the predicate then judged it correctly. Asserting only the verdict lets a matcher that
extracts nothing pass every rejection case vacuously.

Fixtures also have to be *committed*, not run and thrown away. The first round did verify the
rule — against six hand-made probe files under `core/`, deleted once they had failed as
expected (session history). Nothing about that survived into CI.

**Resolve relative specifiers; do not substring-match them.** A regex like `/\.\.\/socket\//`
misses the barrel form `from '../socket'` — which was this repo's own import idiom, and so the
likeliest way the rule would actually have been broken. Resolving against the importing file's
directory closes the barrel form and every future path shape at once, rather than one regex
per shape:

```ts
if (specifier.startsWith('.')) {
  const resolved = path.resolve(fromDir, specifier);
  const layer = SIBLING_LAYERS.find((name) => {
    const dir = path.join(SRC_ROOT, name);
    return resolved === dir || resolved.startsWith(dir + path.sep);
  });
  return layer ? `reaches sideways into ${layer}/` : undefined;
}
```

**Strip comments before matching, and anchor every strip and every static-import alternative
to a line start.** Import statements only appear at the top level, and a `/*` or `//` inside a
string literal must not be allowed to swallow the real import that follows it. The
`require(...)` and `import(...)` alternatives are the exception and *cannot* be anchored —
a real dynamic import appears mid-expression — which is exactly why the guard must exclude its
own file (below).

**Enumerate the package shapes, all of them.** `hono` needed three entries — bare, subpath,
scoped — and `socket.io` needed the same three; the first draft had only the bare form for
`socket.io`, so `socket.io/dist/socket` and `@socket.io/redis-adapter` walked straight through.

**Exclude the guard's own file from the scan it performs.** Once the fixtures exist, the file
contains `require('hono')` as a string, and no text scanner can tell that from the real thing —
and the dynamic-import alternatives that match it are precisely the ones that cannot be
line-anchored. The self-test block is what covers the file in exchange.

**Write down what the guard cannot do.** This one catches *direct* imports only: a `core/`
module reaching a transport through an intermediate module still passes. Proving that needs a
real module graph, which needs a dependency this repo does not carry. Stating the limit in a
comment beats a reader assuming coverage that isn't there.

## Why This Matters

A tripwire that silently stops tripping is worse than no tripwire, because the team stops
looking. Every one of the six holes below was invisible from a green test run — the suite kept
reporting the boundary intact while the boundary was, for those cases, unguarded.

The failure mode is structural, not a matter of care. A scan built to check other files is
never checked by the thing it checks, so the only evidence it works is evidence you write on
purpose. The fixtures cost about forty lines and turn "the boundary is clean" into "the
boundary is clean *and* the check still knows what dirty looks like."

The permission fixtures earn their place separately: they encode the half of the rule that is
easy to over-enforce. `core/` importing `drizzle-orm` and `better-sqlite3` must stay legal,
and a future tightening of the forbidden list that broke that would be caught immediately
rather than by a confusing CI failure in unrelated work.

Worth noting how little the review process caught on its own. The plan-phase form of the rule
was flagged only because two reviewers checked it against the change it was shipping beside,
and the missing fixtures were flagged only in the third round, after the guard had already been
green in CI twice (session history). Reviewing a guard means asking what it would *fail* on —
not reading it for plausibility.

## When to Apply

- A restructure creates a dependency-direction rule that the type system cannot express
- The rule has both a forbidden set and a deliberately-allowed set that looks similar
- A test scans source text with regexes rather than consulting a real module graph
- Any test whose only assertion is "the current tree is fine" — ask what proves the check
  itself still works
- Reviewing a proposed guard: check it against the diff it ships alongside, not in the abstract

## Examples

Six concrete evasions found across two review rounds after the guard was already green:

| # | Evasion | Why the first draft missed it | Fix |
|---|---------|------------------------------|-----|
| 1 | `import 'hono';` | The regex only had a `from`-clause alternative; a side-effect import has no `from` | Added a bare-import alternative — round 2 |
| 2 | Prose read as an import | The lazy `[\s\S]*?` gap before `from` crossed newlines, so an `export` plus a later comment naming a package parsed as one statement | Strip comments first; anchor alternatives to a line start — round 2 |
| 3 | `from '../socket'` (barrel) | Relative rules were substring regexes requiring a trailing slash | Resolve the specifier against the importing file — round 3 |
| 4 | `socket.io/dist/socket`, `@socket.io/redis-adapter` | Only the bare `socket.io` form was listed | Gave `socket.io` hono's three-entry shape — round 3 |
| 5 | A `/*` inside a string literal swallowing the import after it | Comment strips were unanchored | Anchored both strips to a line start — round 3 |
| 6 | A broken matcher passing every file | Nothing tested the matcher | Added the `the guard itself` fixture block — round 3 |

Before — the relative half as substring regexes, which the barrel form walks past:

```ts
const FORBIDDEN = [
  /^hono$/,
  /^hono\//,
  /^@hono\//,
  /^socket\.io$/,
  /\.\.\/http\//,
  /\.\.\/socket\//,
];
```

After — packages by shape, siblings by resolved path:

```ts
const FORBIDDEN_PACKAGES = [
  /^hono$/,
  /^hono\//,
  /^@hono\//,
  /^socket\.io$/,
  /^socket\.io\//,
  /^@socket\.io\//,
];

const SIBLING_LAYERS = ['http', 'socket'];
```

The fixture set also encodes the depth that matters next, before the code that needs it exists
— `core/media/` is where mediasoup lands, and from there a sideways reach is spelled
`../../http/` rather than `../http/`:

```ts
it('rejects a sideways reach from a nested core/ directory', () => {
  const fromDir = path.join(CORE_ROOT, 'media');

  expect(violationOf(fromDir, '../../http/mappers/events.mapper')).toBeDefined();
  expect(violationOf(fromDir, '../../socket')).toBeDefined();
  expect(violationOf(fromDir, '../presence')).toBeUndefined();
});
```

Note the `fromDir`. That fixture was first written against `core/` itself and was simply wrong
(session history): from `core/`, `../../http/` resolves to `apps/server/http`, which is not the
sibling layer and correctly is not a violation. It only bites one level down. A fixture for a
resolving predicate has to name the directory it is resolving from, or it tests nothing.

Two review claims about this guard were **false alarms** and are worth recording so they are not
re-litigated (session history): the substring form `/\.\.\/http\//` was said to miss deeper
reaches, but `../../http/x` contains `../http/` as a substring, so depth was never the hole —
the barrel form without a trailing slash was. And the reason to resolve rather than pattern-match
is generality, not a depth bug.

## Related

- `apps/server/src/core/boundary.test.ts` — the guard itself
- `AGENTS.md` — records the `core/` / `http/` / `socket/` split and the naming rule this
  boundary enforces
- The `foreign_keys` pragma test in `apps/server/src/db` is the same species of tripwire: a
  non-default that is silently inert when unset, so it carries a test rather than trust
