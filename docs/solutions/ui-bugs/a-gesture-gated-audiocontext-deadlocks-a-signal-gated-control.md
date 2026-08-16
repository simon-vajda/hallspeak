---
title: A control gated on a measured signal deadlocks when the signal source needs a gesture the control cannot supply
date: 2026-08-17
category: ui-bugs
module: apps/web
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "The input level meter sits flat at zero while the microphone is visibly open and the OS recording indicator is lit"
  - "Go live never becomes enabled, no matter how loud anyone speaks"
  - "Nothing in the console — no error, no rejected promise, no warning"
  - "Reproduces on Safari and not on Chrome, so it reads as 'works on my machine'"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - audiocontext
  - web-audio
  - safari
  - autoplay-policy
  - user-gesture
  - silent-failure
  - speaker-studio
---

# A control gated on a measured signal deadlocks when the signal source needs a gesture the control cannot supply

## Problem

The speaker studio enables **Go live** only after the input meter has actually moved —
proof that the chosen microphone is producing audio before anyone starts broadcasting.
On a browser that refuses to resume an `AudioContext` outside a user gesture, that gate
could never open: the meter read a flat line forever and Go live stayed disabled, with
no error anywhere. The primary action of the screen was unreachable.

## Symptoms

- The meter is pinned at zero while the microphone is open and the OS recording
  indicator is lit — the capture is real, the measurement is not.
- Go live remains disabled regardless of input.
- No error, no rejected promise, no console warning.
- Chrome is fine; Safari is not. It presents as an environment quirk rather than a bug.

## What Didn't Work

These are the framings that look correct and are not. None of them opens the gate:

- **Check for an error and surface it.** There is no error to check. `context.resume()`
  on a browser that will not resume without a gesture settles without throwing, and the
  analyser dutifully reports silence. A suspended graph and a silent room are
  byte-identical at the `AnalyserNode`. Any handling keyed on `error` is dead code here,
  which is exactly why the failure survived review of the error paths.
- **Resume the context on mount.** Mount is not a gesture. `openCapture` already does
  `await context.resume().catch(() => {})`
  (`apps/web/src/lib/audio/use-mic-capture.ts:51`) and on Safari it is a no-op — kept
  because on browsers that *do* allow it, it is the whole fix.
- **Resume inside the Go live click handler.** The click is a real gesture, but Go live
  is disabled until the meter moves and the meter cannot move until something resumes.
  The one control that could supply the gesture is the one control the deadlock has
  already switched off. This is the crux: the gate's own key is behind the gate.
- **Read `context.state` once at open time and store it.** The state changes later — a
  gesture-driven resume and an OS interruption both arrive afterwards, as a
  `statechange` event. A single read taken during `openCapture` is stale within a tick.

## Solution

Track the context's state as it changes, and let **any** first interaction with the
screen be the gesture.

The hook publishes the live state plus a resume the caller can fire from a real gesture
(`apps/web/src/lib/audio/use-mic-capture.ts`):

```ts
// `suspended` has to track the context rather than the one read taken at open time: a
// gesture-driven resume, and an OS interruption, both arrive as a statechange.
useEffect(() => {
  const context = capture?.context;
  if (!context) {
    setSuspended(false);
    return;
  }

  const sync = () => setSuspended(context.state !== 'running');
  sync();
  context.addEventListener('statechange', sync);
  return () => context.removeEventListener('statechange', sync);
}, [capture]);

/** Must be called from a real user gesture: it is the only thing Safari resumes on. */
const resume = useCallback(() => {
  if (!capture) return;
  void capture.context.resume().catch(() => {});
}, [capture]);
```

The studio then listens window-wide while, and only while, the context is suspended
(`apps/web/src/components/speaker/speaker-studio.tsx:90`):

```tsx
const { suspended, resume } = mic;
useEffect(() => {
  if (!suspended) return;

  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  return () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
}, [suspended, resume]);
```

And the helper text under the meter says what the screen is waiting for, instead of
asking for something that cannot work:

```tsx
mic.suspended
  ? 'This browser starts the meter on your first tap — tap anywhere, then say something.'
  : 'Say something — the meter has to move before you can go live.'
```

## Why This Works

The deadlock is broken by widening the set of gestures that count from *one specific
disabled button* to *anything the user does on the page*. Scrolling, tapping the device
picker, toggling noise suppression, pressing Tab — all of it now resumes the context,
and in practice a speaker touches something before they start talking, so the gate opens
without anyone being told to do anything special.

Three properties make it safe rather than a shotgun listener:

- The effect is **subscribed only while `suspended` is true**, so the listeners unbind
  the moment the resume takes. There is no permanent window-level handler.
- `suspended` is derived from `statechange`, not from a snapshot, so it re-arms if the
  OS suspends the context again later — an interruption mid-session lands in exactly the
  same recovery path rather than being a second, separate bug.
- The copy change means the state is never a mystery. Before, a flat meter and a dead
  button were indistinguishable from a broken microphone.

The `heardSomething` latch above it is deliberately one-way — once the meter has moved,
Go live stays enabled — so the button does not flicker back to disabled while someone
pauses between words.

## Prevention

- **When a control is gated on a measured signal, ask what the user can do if the
  measurement never arrives.** If the answer is "press the control that the missing
  measurement has disabled", the design has a deadlock, whatever the platform. This is
  the general shape; `AudioContext` is only this instance of it.
- **Treat "reports a benign zero" as a distinct failure mode from "throws".** A
  suspended audio graph, a permission that was never granted, and a genuinely silent
  room all reach the `AnalyserNode` as the same numbers. Anywhere a sensor can be
  *inert* rather than *failing*, the inert case needs its own state — here, `suspended`
  as a field separate from `error`, which is the same separation the sibling fix made
  between `notice` and `error` in the same commit.
- **Never store a one-shot read of `AudioContext.state`.** Subscribe to `statechange`.
  The value changes under you on gesture, on OS interruption, and on tab backgrounding.
- **Test the studio in Safari before calling a capture change done.** Chrome's autoplay
  policy is permissive enough that this entire class of bug is invisible there. A
  gesture-policy failure that only reproduces in one browser will otherwise be found by
  a user, not by us.

## Related Issues

- Fixed by the commit "fix(review): close four real defects in the microphone layer" on
  `feat/guest-and-speaker-screens`, one of the four. Cited by message rather than SHA —
  the branch was unmerged as of this writing and a squash would rewrite the hash.
- `apps/web/src/lib/audio/use-mic-capture.ts` — the capture layer; its other two
  non-obvious rules (open a stream before enumerating or device labels come back empty;
  the system default is listed twice as a `default`/`communications` alias) are recorded
  in `CLAUDE.md`.
- `docs/solutions/workflow-issues/browser-permission-prompts-stall-the-agent-silently.md`
  — the neighbouring hazard on the same screen: a Chrome permission prompt that also
  produces a screen where nothing moves and nothing errors.
