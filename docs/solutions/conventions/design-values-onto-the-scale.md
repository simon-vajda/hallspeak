---
title: Put design-file values on the scale instead of transcribing them as arbitrary utilities
date: 2026-08-14
category: conventions
module: apps/web
problem_type: convention
component: frontend_stimulus
severity: medium
applies_when:
  - "Building a screen from a design handoff that specifies pixel values"
  - "A design value is off Tailwind's default scale (26px, 18px, 1120px)"
  - "Deciding whether a value earns a named token, a scale step, or stays arbitrary"
  - "Reviewing new UI code for call-site literals"
tags:
  - tailwind
  - design-system
  - design-tokens
  - spacing-scale
  - theme-variables
  - arbitrary-values
  - code-review
---

# Put design-file values on the scale instead of transcribing them as arbitrary utilities

## Context

A design handoff gives pixel values. The path of least resistance is to type each one where it appears — `px-[26px]`, `size-[26px]`, `max-w-[460px]` — and the screen renders correctly, so nothing complains. That is exactly what happened while the Home route was first built, and a follow-up refactor had to go back and undo it across every call site (`4236e27`).

The result renders identically either way. What differs is what happens on the second screen: the value has no name, so the next screen re-types it, and the two copies drift the first time the design changes. There is nothing to grep for and nothing to change in one place.

Colours never went wrong here — they were written as theme tokens from the start, and no hex literal appears in any call site in this repo's history. The rule below is stated for both because the reasoning is identical and only the spacing half got tested by an actual mistake.

## Guidance

Every value from the design file resolves to one of four homes. Work down the list and stop at the first that fits.

**1. A theme token, if it is a colour.** Always. Colours go in `index.css` as `--color-*` and are referenced by role at the call site — `text-muted-foreground`, `bg-secondary`, `border-destructive`. Never a hex literal in a component, and never a raw palette name standing in for a role. A role survives a re-theme and a dark-mode pass; a hex does not, and a role borrowed to mean something it isn't reintroduces the ambiguity the palette was built to remove.

**2. A named spacing token, if the value is semantic.** It earns a name when it names a thing, repeats across screens, and changes at a breakpoint. Two qualified: `--spacing-gutter` (the screen gutter) and `--spacing-shell` (the admin content cap). The test is whether a reader at the call site is better served by the name than by the number — `px-gutter` says what it is, `px-6.5` says only how big.

**3. A scale step, if it is off-scale but ordinary.** This is where most values land, and it is the step most often skipped. Tailwind v4 derives the whole spacing scale from `--spacing`, which is left at its 4px default here, so any multiple of 4px is already a step and quarter-multiples are fractional steps: divide by 4 and use it. 26px is `6.5`, 30px is `7.5`, 200px is `50`, 460px is `115`, 1120px is `280`. `px-[26px]` is never the right answer.

**4. Arbitrary, if it is genuinely one-off.** One-off type sizes and bespoke tracking at a single breakpoint (`lg:text-[52px]`, `lg:tracking-[-0.045em]`) and grid templates stay arbitrary, because a name for a value used once is worse than the value. This is a real category, not a loophole — the point is that it is the last resort, not the first.

One extra case sits alongside these: when the design fixes size, weight and tracking **together** as a named step, that is a type ramp entry, not three utilities. This project's ramp is four `--text-*` entries — `text-screen`, `text-section`, `text-label`, `text-meta` — each carrying its own line-height and weight, plus tracking where the design fixes one (`text-meta` does not), so a call site names the step once. Body text is Tailwind's own `text-sm`.

## Why This Matters

The failure mode is silent. Arbitrary utilities are not a bug, do not fail typecheck or lint, and look right in the browser — so nothing surfaces them until the design changes and half the call sites move while the other half don't. By then the values have been copied into screens nobody is currently editing.

The cost is also asymmetric in time. Putting a value on the scale while writing the line is free. Retrofitting it means finding every literal spelling of the same number across screens that have since diverged, which is what `4236e27` had to do — and it could only be done confidently because the app was still two routes.

There is a second, quieter benefit: a call site written in scale steps and role names is reviewable. `mt-6.5 lg:w-50` and `text-muted-foreground` can be checked against the design without a calculator, and a wrong value looks wrong. `mt-[26px]` and `text-[#64748B]` can only be checked by looking up what the token should have been.

## When to Apply

- Whenever transcribing a design handoff into markup — this is the moment the decision is cheap.
- In review of any new UI: a bracketed utility carrying a colour or a plain pixel length is the smell. Bracketed `data-[…]`, `has-[…]` and `grid-cols-[…]` are not — those are variants and templates, not values.
- When a value that was legitimately one-off appears a second time. Its category changed; move it to a scale step or a name.

## Examples

Before and after from `4236e27`, on the Home route. Every kind of decision appears in this one diff. Both blocks are trimmed to the classes that moved — the real lines also carry layout and responsive classes that were untouched. `lg:tracking-[-0.045em]` is the one exception, shown in the after block only to make the "left arbitrary" case visible; it is unchanged on both sides:

```tsx
// before — every value transcribed at the call site
<div className="absolute top-3.5 right-[26px] z-10 lg:top-4 lg:right-10">
<main className="flex flex-1 flex-col px-[26px] pt-8 pb-[26px] lg:px-10 lg:pt-[88px] lg:pb-24">
  <form className="flex flex-col lg:w-full lg:max-w-[460px]">
    <h1 className="mb-1.5 text-3xl leading-[1.06] font-semibold tracking-[-0.035em] lg:text-[52px]">
    <p className="mb-[26px] text-sm lg:mb-[30px]">
    <Button className="mt-8 w-full lg:mt-[26px] lg:w-[200px]">
```

```tsx
// after — semantic name, scale step, ramp entry; one-off type size left alone
<div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
<main className="flex flex-1 flex-col px-gutter pt-8 pb-gutter lg:px-10 lg:pt-22 lg:pb-24">
  <form className="flex flex-col lg:w-full lg:max-w-115">
    <h1 className="mb-1.5 text-screen lg:text-[52px] lg:tracking-[-0.045em]">
    <p className="mb-gutter text-sm lg:mb-7.5">
    <Button className="mt-8 w-full lg:mt-6.5 lg:w-50">
```

Reading the four homes off that commit — every row but `--spacing-shell` is visible in the excerpt above; the shell cap comes from the same commit's `index.css` hunk and is used on the admin layout route:

| Value | Home | Why |
|---|---|---|
| 26px gutter | `--spacing-gutter` → `px-gutter` | Names a thing, repeats, changes to 40px at `lg` |
| 1120px | `--spacing-shell` | Same, for the admin content cap |
| 30px, 200px, 460px, 88px | `7.5`, `50`, `115`, `22` | Off-scale but ordinary — divide by 4 |
| 30px/1.06/-0.035em/600 as a set | `text-screen` | Size, line-height, tracking and weight travel together |
| `lg:text-[52px]`, `lg:tracking-[-0.045em]` | left arbitrary | One-off, single breakpoint, used once |

Arbitrary px lengths surviving in the tree today, and why:

- `apps/web/src/components/ui/switch.tsx:22` and `badge.tsx:8` — shadcn CLI output, not ours to rewrite. The `lg` size added to the switch locally is written on the scale (`h-6.75 w-11.5`): generated code is not a licence to match its style when extending it.
- `apps/web/src/routes/index.tsx:21` and `:23` — `rounded-[14px]` on the PIN slots. Hand-written, and a plain pixel length, so it looks like the smell above. It is deliberate: the radius scale derives from `--radius` (20px), so 14px has no clean step, and the adjacent comment says so. A one-off with a stated reason is category 4; without the comment it would just be a miss.

Type sizes are the category to watch. Twelve `text-[Npx]` values live across the admin screens, which category 4 permits — but `text-[13px]` now appears in three files and `text-[18px]` in two. By the rule above their category has changed: repeated values want a ramp entry or a scale step, and these are candidates the next design pass should absorb.

## Related

- `AGENTS.md` carries the short form of this rule alongside the concrete values already mapped; this doc is the procedure for the next value.
- `apps/web/src/index.css` holds the `@theme` block — the scale entries and the type ramp — with the design's hex values kept in comments as the source of truth.
- Deliberate customisations to `components/ui` must be recorded in `AGENTS.md`, because re-running `shadcn add` silently drops them.
