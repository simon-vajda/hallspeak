---
title: Ask for the Chrome permission before driving the browser at a gated resource
date: 2026-08-17
category: workflow-issues
module: development_workflow
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Driving the app through chrome-devtools-mcp on a screen that calls getUserMedia"
  - "Testing a copy button by reading the clipboard back"
  - "Any first visit to an origin that will request microphone, camera, clipboard-read, geolocation or notifications"
  - "A browser step returns success but the snapshot shows nothing happened"
tags:
  - chrome-devtools-mcp
  - browser-testing
  - permissions
  - getusermedia
  - clipboard
  - agent-workflow
---

# Ask for the Chrome permission before driving the browser at a gated resource

## Context

The speaker studio calls `getUserMedia`, and the admin share cards copy links to the
clipboard. Both are gated by a Chrome permission prompt on the first visit to an origin.
When an agent drives the browser through `chrome-devtools-mcp` and trips one of those
gates, Chrome raises its permission bubble and waits — for a human who may not be
looking at that window.

The agent cannot see the bubble, cannot dismiss it, and cannot grant the permission.
None of that is a bug in the MCP server; it is what the tool surface is. The failure
worth knowing is the second-order one: **half the time the stall does not look like a
stall.**

## Guidance

**Before the first browser step that touches a gated resource on an origin, stop and
ask the user to grant the permission in Chrome.** Name the origin and the permission,
then wait for confirmation before continuing.

> Before I drive the speaker studio: `http://localhost:5173` will ask for microphone
> access on the first `getUserMedia` call. Chrome will raise its permission bubble and
> I can neither see nor answer it. Please grant it (or tell me it is already granted)
> and I'll continue.

Gated in Chrome, in rough order of how often they come up in this repo: **microphone
and camera** (`getUserMedia`), **clipboard read** (`navigator.clipboard.readText`),
**notifications**, **geolocation**, **MIDI**. Clipboard *write* from a real user
gesture is auto-granted to the focused tab and does not prompt — so a "copy link"
button click usually goes through, and it is the attempt to *verify* it by reading the
clipboard back that gets stuck.

Once granted, the grant sticks for that origin in the profile that Chrome is running,
so this is a one-time gate per origin per permission — unless the server was started
with `--isolated`, which creates a throwaway user-data-dir and therefore re-prompts
every session.

## Why This Matters

Two distinct failures come out of skipping the ask, and the quiet one is worse.

All file references below are inside the **chrome-devtools-mcp package** (verified at
v1.7.0), not this repo.

**The hang.** `evaluate_script` awaits the promise you return, with no tool-level
timeout of its own (its `src/tools/script.ts` calls `evaluatable.evaluate` directly;
the 5s `DEFAULT_TIMEOUT` in its `src/McpPage.ts` applies to the waiting helpers, not to
evaluation). So `await navigator.mediaDevices.getUserMedia({audio: true})` blocks until
the MCP client kills the call. Loud, and at least legible once it fails.

**The false negative.** A `click` on "Allow microphone" or "Go live" *succeeds* — the
click really did land. The permission request it started is still pending behind the
bubble, so the next `take_snapshot` shows a screen where nothing moved. That reads
exactly like an app defect, and the natural next move is to go debug `use-mic-capture.ts`
for a bug that is not there. Time is lost, and worse, a wrong conclusion can end up in
a commit message or in this docs tree.

There is no in-band escape from either. `handle_dialog` does not apply: it is wired to
Puppeteer's `page.on('dialog')` event (its `src/McpPage.ts:161`), which fires only for
JavaScript dialogs — `alert`, `confirm`, `prompt`, `beforeunload`. A permission bubble
is browser chrome, not a page dialog, so `getDialog()` returns undefined and
`handle_dialog` throws `No open dialog found`. The server exposes no
`Browser.grantPermissions` equivalent — grepping its own source for `grantPermissions` or
`overridePermissions` returns nothing. And `take_screenshot` captures the page
viewport, not the browser frame, so the agent cannot even observe that a prompt is up.

Asking first costs one turn. Not asking costs a stalled tool call, or an invented bug.

## When to Apply

- Before the first `navigate_page` to a screen whose load path calls `getUserMedia` —
  in this repo, the speaker studio route.
- Before clicking any control that opens a device: "Allow microphone", the device
  picker's retry, "Go live".
- Before reading the clipboard back to verify a copy button on the admin screens.
- Retroactively, as a diagnosis: when a browser step reports success and the following
  snapshot shows an unchanged screen, suspect a pending permission bubble **before**
  suspecting the app.

## Examples

Wrong — the click succeeds, the snapshot is stale, and the agent goes hunting:

```
navigate_page  http://localhost:5173/e/<pin>/en?speaker_code=…
click          uid=… ("Allow microphone")     → "Successfully clicked"
take_snapshot                                  → still the pre-flight empty state
# → "the mic panel isn't reacting" → opens use-mic-capture.ts → nothing wrong there
```

Right — one turn spent, then everything downstream behaves:

```
"The speaker studio calls getUserMedia on this route. Chrome will prompt on the
 first visit to localhost:5173 and I can't answer that prompt. Grant microphone
 access there and tell me when it's done."
→ user grants
navigate_page … ; click … ; take_snapshot      → live device list, meter moving
```

Config-level alternative, if browser permission prompts become routine rather than
occasional: the server accepts `--chromeArg`, so flags like
`--use-fake-ui-for-media-stream` (auto-accept media prompts, with a fake device) can be
added to the MCP server config. This applies **only when chrome-devtools-mcp launches
Chrome itself**, and a fake device defeats the point of testing real capture — so
prefer granting once on the real origin, and treat the flag as a last resort for a
throughput problem, not the default.

## Related

- `docs/solutions/conventions/design-values-onto-the-scale.md` — the other convention
  learned while building these screens.
- `apps/web/src/lib/audio/use-mic-capture.ts` — the capture layer this gate sits in
  front of; its own non-obvious rule (open a stream *before* enumerating, or labels
  come back empty) is a separate permission consequence, recorded in `CLAUDE.md`.
- Verified against `chrome-devtools-mcp@1.7.0`. If a future version adds a
  permission-granting tool, this doc's "no in-band escape" claim is the part to
  re-check.
