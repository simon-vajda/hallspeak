---
title: An unknown reading is not a negative one
date: 2026-08-30
category: conventions
module: apps/web
problem_type: convention
component: frontend_stimulus
severity: high
applies_when:
  - "A screen reports state it learns from a poll, a socket, or another source that can fail"
  - "A destructive or irreversible action is gated on that reported state"
  - "A falsy default doubles as both 'no' and 'not yet known'"
  - "Copy or a badge names a state a person will act on"
resolution_type: code_fix
related_components:
  - apps/web/src/lib
  - apps/web/src/components/admin
tags:
  - status-reporting
  - polling
  - ui-copy
  - accessibility
  - liveness
  - confirmation-dialogs
---

# An unknown reading is not a negative one

## Context

The admin surfaces report which channels have an interpreter broadcasting. That reading comes
from `GET /admin/live`, polled every five seconds (`apps/web/src/lib/admin-queries.ts`,
`LIVE_POLL_MS`). A poll can be pending, failed, or hung, and the payload's shape makes the
failure mode invisible: an event or channel that nobody is broadcasting on is simply *absent*
from the response. An empty index and a dead poll therefore look identical.

Read naively, that collapses into a falsy default. A failed poll yields no entries, every
lookup misses, and each screen prints `Nobody on air`. Nothing errors and nothing looks
stale — the page states, confidently and in the product's own words, that a broadcast which
may well be running is not. An organiser reads that and rings an interpreter who is mid-
sentence, or presses Delete on an event that is live.

The same shape appears twice more on the public side. The guest's connection line was
reporting `Connected` for a socket with no media leg behind it, which is an answer to a
question nobody asked. And REST can say a channel is online but cannot say whether its
producer is paused, so mute arrives as genuinely unknown rather than as false.

## Guidance

**Give the unknown case its own value, carry it to every consumer, and let each consumer
withhold rather than substitute the negative.**

1. **Make the reading's own health part of its type.** `AdminLiveIndex` carries a `known`
   boolean beside its maps, set from `isLiveReadingFresh(isSuccess, dataUpdatedAt, now)`.
   Freshness is not just "did the last request succeed": a hung poll produces no state change
   at all, so `useAdminLive` ticks a clock on the poll interval and treats a reading older than
   `LIVE_STALE_AFTER_MS` (three intervals) as unknown. Without that tick the last good answer
   would keep re-rendering as current.

2. **Model the three outcomes as three states, not two plus a flag at each call site.**
   `channelBroadcast(live, liveKnown)` returns `{ state: 'withheld' } | { state: 'offline' } |
   { state: 'on-air'; listeners }` (`apps/web/src/lib/format.ts`). `eventStatusLabel` returns
   `{ label, withheld }`. The discriminant travels with the value, so a consumer cannot forget
   the third case.

3. **Withhold visibly, and say so in words for a screen reader.** The withheld admin status
   renders an em dash plus a visually hidden `STATUS_UNKNOWN` — "Status unknown"
   (`admin-channel-row.tsx`, `admin-event-row.tsx`). A dash alone is a withholding to a sighted
   reader and nothing at all to anyone else.

4. **Let configuration outrank the poll, but never let the poll's silence outrank itself.**
   `eventStatusLabel` still prints `Disabled` and `No channels yet` under a dead poll: those are
   facts the poll has no bearing on. It refuses to print `Nobody on air`, because that one is
   the poll's to say.

5. **Gate confirmations on the same flag, in both directions.** `disableConfirmation`
   (`apps/web/src/lib/admin-live-warning.ts`) returns a `live` notice for a confirmed-live
   target, an `unknown` notice — `LIVENESS_UNKNOWN`, "Whether anyone is on air right now could
   not be checked." — when `liveKnown` is false, and null otherwise. A withheld reading must not
   silently warn about nothing *or* silently warn as if live; it reports the gap. `eventLiveWarning`
   and `channelLiveWarning` return `undefined` for a withheld reading, and every caller treats
   `undefined` as silence.

6. **Where the answer is genuinely "nothing to report", render nothing rather than a
   reassurance.** `resolveLinkState` (`apps/web/src/lib/media/link-state.ts`) returns `idle`
   when the socket is connected and `mediaWanted` is false, and `ConnectionLine` renders empty
   there. Two details make that safe: `idle` is reachable *only* under a connected socket, so
   silence never means "not yet"; and `isLinkUp` counts `idle` as up, so broadcast copy gates on
   that helper rather than on the line's own vocabulary — otherwise a guest idling on a live
   channel would read `Offline`.

7. **An unknown sub-state falls back to the reading that is known, not to a "checking" label.**
   REST online maps to `{ online: true, muted: null }`; the guest badge shows `On air` rather
   than announcing that it is checking (see the related convention below).

## Why This Matters

The failure is silent in exactly the way that matters most. A network error surfaces; a falsy
default does not. The screen keeps working, keeps updating, and keeps asserting — it just
asserts the negative. Because the negative here (`Nobody on air`) is also the *common* and
*unalarming* case, nothing about the rendering invites a second look.

The cost lands on an irreversible action. The four destructive dialogs and the two enable
switches exist to stop an organiser cutting a live broadcast. Built on a falsy default, they
would go quiet precisely when the system had lost track of what is live — the moment their
warning is worth the most. A stale reading is indistinguishable from a fresh one at the pixel
level, so the distinction has to be carried in the data.

The same argument runs the other way for the guest connection line, and this is why the
principle is "withhold", not "warn". A line that said `Connected` about a socket carrying no
media was not withholding, it was answering a question the guest had not asked, with a word
they would reasonably read as being about their audio. Reporting an axis nobody is on is the
mirror image of reporting a negative you cannot verify: in both cases the surface says more
than it knows.

## When to Apply

- Adding any screen state derived from a poll, a socket snapshot, or an endpoint whose absence
  of an entry is meaningful.
- Adding a confirmation, warning, or disabled state gated on remote state.
- Writing copy that names a state — "Nobody on air", "Offline", "Connected", "0 listening".
  Ask what that copy says when the source is down.
- Reviewing a lookup whose miss path returns a default. If `undefined` means both "no" and
  "don't know", the default is a bug.

## Examples

**A payload where absence is meaningful.** `GET /admin/live` lists only live channels. Absence
means idle *and* means failure; only `known` separates them:

```ts
const known = isLiveReadingFresh(isSuccess, dataUpdatedAt, now);
return useMemo(() => indexLive(known ? data : undefined, known), [data, known]);
```

**Three outcomes, one discriminated union.**

```ts
if (!liveKnown) return { state: 'withheld' };
if (!live?.online) return { state: 'offline' };
return { state: 'on-air', listeners: live.listeners };
```

**Configuration outranks the poll; the poll's own answer does not.**

```ts
if (!event.enabled) return { label: 'Disabled', withheld: false };
if (event.channels === 0) return { label: 'No channels yet', withheld: false };
if (!event.liveKnown) return WITHHELD;              // never 'Nobody on air'
if (event.onAir === 0) return { label: 'Nobody on air', withheld: false };
```

**The unknown case gets its own sentence in a confirmation**, rather than inheriting either the
live warning or the silence (`disableConfirmation`, tone `'unknown'`).

**Regression coverage.** `apps/web/src/lib/admin-live-warning.test.ts`,
`apps/web/src/lib/format.test.ts`, `apps/web/src/lib/admin-queries.test.ts` and
`apps/web/src/lib/media/link-state.test.ts` pin the withheld paths. When adding a consumer of a
pollable reading, add the "source is down" case beside the positive and negative ones — two
cases in a test file is itself the signal that the third state was collapsed.

## Related

- [Separate channel liveness from listener mute state](separate-channel-liveness-from-listener-mute-state.md)
  — the domain-side companion: which axis each state answers, and where mute may travel. This
  doc is about what a surface says when it cannot read an axis at all.
- [Diagnosing live audio from a user's description](../operations/diagnosing-live-audio-from-a-user-report.md)
  — the operational counterpart when a reading is available but wrong.
- `CONCEPTS.md` defines *Live*, *Muted* and *Withheld*.
