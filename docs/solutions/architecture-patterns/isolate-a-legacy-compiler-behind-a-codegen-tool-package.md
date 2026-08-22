---
title: Isolate a legacy compiler behind a private codegen tool package
date: 2026-08-17
category: architecture-patterns
module: tools/openapi-codegen
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - "A code generator needs an older major of a compiler than the repo runs on"
  - "Two versions of the same toolchain package would otherwise sit in one workspace"
  - "Deciding where to park a dependency that only one build step needs"
  - "Reviewing whether a pinned toolchain version is still required"
tags:
  - typescript
  - openapi
  - codegen
  - monorepo
  - pnpm-workspace
  - dependency-isolation
---

# Isolate a legacy compiler behind a private codegen tool package

## Context

Every real package in this repo pins `typescript@7.0.2`. `openapi-typescript`, which generates
`packages/contract/src/generated/api.d.ts` from `openapi.json`, cannot run on it: it emits its
output through the `ts.factory` AST API, which TypeScript 7.0 does not expose. A programmatic
API returns in 7.1.

The obvious fix — add `typescript@5` to `packages/contract`'s devDependencies — puts two
majors of the compiler in the same resolution scope. From then on, which `tsc` a script gets
depends on hoisting, and a typecheck that silently ran on the wrong compiler reports green.

## Guidance

`tools/openapi-codegen` is a private workspace package whose only job is holding
`typescript@5.9.3`. It exposes an `openapi-codegen` bin that runs openapi-typescript's own CLI
in-process, from its own TypeScript 5 resolution scope. `packages/contract` depends on it, so
the arrow points `contract → openapi-codegen` and the tool knows nothing about the contract's
layout.

The invariant this buys: TypeScript 5 appears in exactly one `package.json` and is not
reachable as a binary from any package that compiles source. `pnpm why -r typescript` is the
mechanical form of that check.

The shape generalises. When one build step needs a version of a toolchain the rest of the repo
has moved past, give it its own package rather than its own dependency entry, and have it
expose a bin rather than a library — the version boundary then coincides with a process
boundary, which nothing can hoist across.

## Exit condition

Delete `tools/` when TypeScript 7.1 ships its programmatic API and `openapi-typescript` adopts
it. `openapi-typescript` moves into `packages/contract`'s devDependencies at that point, and
the `openapi-codegen` bin disappears from `contract`'s `gen:types` script.

## Related

- `AGENTS.md` carries the rule and points here.
- `packages/contract/package.json` — the `gen:types` script and the dependency on the tool.
