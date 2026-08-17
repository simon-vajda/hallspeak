---
title: Why shadcn customisations are allowed but must be recorded
date: 2026-08-17
category: conventions
module: apps/web
problem_type: convention
component: frontend_stimulus
severity: medium
applies_when:
  - "Running `shadcn add` to install or update a component"
  - "A design needs a size or behaviour upstream shadcn does not ship"
  - "Deciding between editing components/ui and styling at the call site"
  - "A lint rule fires inside generated component code"
tags:
  - shadcn
  - tailwind
  - biome
  - code-generation
  - design-system
---

# Why shadcn customisations are allowed but must be recorded

## Context

`apps/web/src/components/ui` is the shadcn CLI's target. The CLI's model is that scaffolded
code is yours: it copies source into the repo rather than shipping a dependency, so editing it
is the intended workflow, not a hack.

The cost is that `shadcn add <name>` overwrites the file. A local customisation vanishes
silently the next time anyone updates that component — and `add` will also offer to overwrite
a component pulled in as a *dependency* of the one being installed (`sheet` does this to
`button`), so the loss can happen while installing something unrelated.

## Guidance

**Customise, but record it.** `CLAUDE.md` carries the ledger of current customisations to
`components/ui`, because that file loads into every session and a `docs/solutions/` entry is
only read on purpose. An unrecorded customisation is one `add` away from gone.

**Decline the overwrite prompt** when `add` offers to replace a component it pulled in as a
dependency.

**Run `pnpm check:fix` after every CLI run.** The CLI's formatting differs from Biome's.

**Prefer call-site classes for one-off styling.** Reserve edits to `components/ui` for things
that belong to the component itself — a missing size in the design system, a cursor affordance
Tailwind v4 dropped from its base layer and upstream has not re-added.

**Do not hand-fix lint errors in generated files.** `biome.json` turns six rules off for that
directory only — four `a11y` rules, `noArrayIndexKey`, `noDoubleEquals`. Upstream shadcn trips
them by design (`role="group"` on a div, a `Label` primitive with no control), and a hand-fix
just means the next `add` reintroduces the error. Formatting still applies, which is why
`check:fix` follows every CLI run.

## Related

- `CLAUDE.md` — the current customisation ledger and the rules in short form.
- `biome.json` — the per-directory rule carve-out for `apps/web/src/components/ui`.
- `docs/solutions/conventions/design-values-onto-the-scale.md` — where a new design value
  belongs when a customisation needs one.
