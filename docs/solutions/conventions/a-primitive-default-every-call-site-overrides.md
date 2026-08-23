---
module: apps/web
tags: [design-system, shadcn, components]
problem_type: convention
---

# A primitive default that every call site overrides is a bug, not a style

## Problem

`components/ui/switch.tsx` shipped `data-checked:bg-primary`. Every switch in the app is an
enable control, and `primary` is the action colour, so both `enabled-switch.tsx` and
`mic-panel.tsx` declared an identical `data-checked:bg-foreground` to cancel it. The same
shape appeared on `DialogContent` (`DIALOG_PANEL` in three files), on `Input` (`AUTH_FIELD`
and two `TEXT_INPUT`s), and on the button scale (five constants and three inline copies).

The cost is not the duplication. It is that a new call site that *forgets* the override
renders in the one colour the palette rule forbids, and nothing catches it: the primitive's
default is unreachable dead code that still governs anything nobody remembered to correct.

## Rule

When every call site of a `components/ui` primitive overrides the same default, the product's
value belongs in the primitive and the constants that were cancelling it get deleted. Exporting
a shared constant instead keeps the inversion and adds an import graph on top of it.

Where a second value is genuinely needed, it becomes a named variant with the product's value
as the default — `Switch`'s `tone`, `Input`'s `shape` — so the non-default is an explicit,
visible opt-in rather than the thing you get by saying nothing.

Every such edit is a customisation of a generated file, so record it in `AGENTS.md`'s shadcn
list: see `customising-generated-shadcn-components.md`.

## Check

`grep` the retired spelling. After the change it must appear only inside `components/ui`.
