---
title: Decline pnpm's inferred native build for better-sqlite3
date: 2026-08-17
category: integration-issues
module: apps/server
problem_type: integration_issue
component: database
severity: medium
applies_when:
  - "pnpm install exits 1 with ERR_PNPM_IGNORED_BUILDS"
  - "Deciding whether to run `pnpm approve-builds` for a native addon"
  - "A dependency ships a binding.gyp but no install script"
  - "Setting up the repo on a new machine or in CI"
tags:
  - pnpm
  - better-sqlite3
  - native-addons
  - node-gyp
  - prebuilt-binaries
---

# Decline pnpm's inferred native build for better-sqlite3

## Context

`better-sqlite3` has no install script, but it ships a `binding.gyp`. pnpm infers a
`node-gyp rebuild` from that file alone and, because the build is not approved, exits 1 with
`[ERR_PNPM_IGNORED_BUILDS]`. The obvious reading is that the dependency is broken and needs
its build approved.

## Guidance

It is listed as `false` in `pnpm-workspace.yaml`'s `allowBuilds`, and that is the correct
setting. **Do not run `pnpm approve-builds` for it.**

The tarball ships prebuilt N-API binaries for all eight platform/libc targets, and N-API is
ABI-stable across Node 22/24/26. Compiling from source buys nothing and costs a toolchain
dependency on every machine that installs — including the small self-hosted servers this
project targets, where a missing `node-gyp` toolchain is the likeliest install failure.

The general form: a `binding.gyp` is evidence a package *can* be compiled, not that it must
be. Check for prebuilt binaries before approving a build pnpm inferred rather than one the
package actually declared.

## Related

- `AGENTS.md` carries the rule and points here.
- `pnpm-workspace.yaml` — the `allowBuilds` entry.
