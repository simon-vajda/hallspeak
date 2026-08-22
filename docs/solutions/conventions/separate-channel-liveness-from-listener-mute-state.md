---
title: Separate channel liveness from listener mute state
date: 2026-08-23
category: conventions
module: apps/server
problem_type: convention
component: api
severity: medium
applies_when:
  - "A media-backed list needs to report whether a channel is on air"
  - "A paused producer remains allocated while its audio is intentionally silent"
  - "The same runtime state is projected through REST and a realtime transport to audiences with different needs"
  - "A listener UI must distinguish interpreter mute from producer disappearance"
resolution_type: code_fix
related_components:
  - packages/contract
  - apps/web
tags:
  - mediasoup
  - socket-io
  - rest-api
  - liveness
  - muted-state
  - api-design
---

# Separate channel liveness from listener mute state

## Context

LinguaCast has several nearby states that answer different questions and must not be
collapsed into one status:

- **Enabled** is an administrator's access decision. An Event and its Channel must both be
  enabled before a guest can reach the Channel; it says nothing about whether audio exists
  (`CONCEPTS.md:7`, `CONCEPTS.md:19-22`).
- A **broadcast claim** is the exclusive right to produce on a Channel. It is taken during
  the Speaker's Socket.IO handshake, before media exists, and is held in the in-memory
  presence registry (`apps/server/src/core/access.ts:31-35`,
  `apps/server/src/core/access.ts:61-76`, `apps/server/src/core/presence.ts:9-16`). A
  connected studio can therefore hold the claim without being Live.
- **Live**, exposed in code as `online`, means that the media Room has an unclosed Producer
  for the Channel. It is derived from the producer map, not from enablement, a socket
  connection, or a presence claim (`CONCEPTS.md:24-27`,
  `apps/server/src/core/media/room.ts:46-60`, `apps/server/src/core/media/index.ts:112-128`).
- **Muted** means that the existing Producer is paused. Pausing stops its audio without
  closing it, so the Channel remains Live (`CONCEPTS.md:91-94`,
  `apps/server/src/core/media/index.ts:272-299`).
- **Armed** means a Listener has made the one deliberate request to hear a Channel and is
  waiting for audio. **Listening** is narrower: the guest currently holds an open, locally
  unpaused Consumer on the Channel's Producer (`CONCEPTS.md:36-51`,
  `apps/server/src/core/media/peer.ts:59-67`). Producer pause is deliberately ignored by
  listener counting, so a muted interpreter can still have Listeners.

Earlier design work correctly separated claim ownership, Producer existence, and Producer
pause, but a later public-experience plan initially proposed carrying `muted` through the
shared REST channel representation as well as Socket.IO (session history). That projection
blurred two questions: “is an interpreter producing on this Channel?” and “why is this active
Listener hearing silence?”

The boundary was finalized in merged [PR #1](https://github.com/simon-vajda/linguacast/pull/1):
Producer existence is the authoritative liveness signal, while mute is a transient,
listener-facing explanation for silence. Mute is not a REST field.

## Guidance

Treat `online` and `muted` as related readings of one Producer, but give them different
distribution boundaries.

1. **Derive liveness from Producer existence.** `Room.isOnline()` returns true while the
   Channel's Producer exists and is not closed. `Room.channelStatus()` reads that same
   Producer once and returns `{ online: true, muted: producer.paused }`
   (`apps/server/src/core/media/room.ts:50-60`). Closing the Producer is the transition to
   offline. Pausing or resuming it must never change `online`.

2. **Keep REST list and admin representations liveness-only.** The public `PublicChannel`
   schema contains `slug`, `name`, and `online`, with no `muted` field
   (`packages/contract/src/schemas/event.ts:7-13`). Its HTTP mapper calls the media facade's
   `isOnline()` directly (`apps/server/src/http/mappers/channels.mapper.ts:17-23`). The admin
   live schema likewise carries `online` and `listeners`, not mute
   (`packages/contract/src/schemas/event.ts:64-83`); its endpoint enumerates live Producers
   and emits `online: true` for those entries
   (`apps/server/src/http/routes/admin/live.routes.ts:6-31`).

3. **Carry mute over Socket.IO, where it can explain silence.** The socket contract requires
   both `online` and `muted` in the `channel:join` acknowledgement and `channel:status` event
   (`packages/contract/src/schemas/socket.ts:21-30`,
   `packages/contract/src/socket/contract.ts:34-41`,
   `packages/contract/src/socket/contract.ts:81-87`). Joining a Channel returns the media
   layer's current atomic snapshot (`apps/server/src/socket/handlers/channels.handlers.ts:18-29`).
   Producer open and close publish status to the Event room, while pause and resume publish
   it only to the affected Channel room
   (`apps/server/src/socket/handlers/lifecycle.handlers.ts:48-64`).

4. **Let selectors consume only the liveness projection.** The client stores revisioned
   Socket.IO status snapshots but exposes selectors a `slug -> online` projection
   (`apps/web/src/lib/channel-status.ts:7-35`, `apps/web/src/lib/use-socket.ts:27-36`). The
   public selector renders that value and falls back to the REST `online` seed
   (`apps/web/src/routes/events/$pin/index.tsx:17-18`,
   `apps/web/src/routes/events/$pin/index.tsx:50-58`). A muted Producer therefore stays “On
   air” in lists.

5. **On the listener route, treat HTTP as a liveness seed only.** An online REST response maps
   to `{ online: true, muted: null }`, because REST cannot authoritatively say whether the
   Producer is paused (`apps/web/src/lib/channel-status.ts:38-45`). The Listener joins the
   Channel room and reconciles the acknowledgement with later realtime events
   (`apps/web/src/routes/events/$pin/$slug.tsx:65-78`,
   `apps/web/src/routes/events/$pin/$slug.tsx:107-123`). Until mute is known, the UI reports
   that it is checking status; when muted, it explains that audio will resume automatically
   (`apps/web/src/components/guest/listen-state.ts:38-50`,
   `apps/web/src/components/guest/listen-state.ts:89-108`,
   `apps/web/src/components/guest/listen-state.ts:121-140`).

Do not infer Live from presence, claim ownership, UI state, or a connected Socket.IO session.
Do not end a Producer to implement mute. Do not add `muted` to public or admin REST schemas
merely because the media layer can read it. If another realtime consumer eventually needs
mute, extend the Socket.IO audience deliberately; keep selector and admin presentation based
on `online` unless their product requirement changes.

## Why This Matters

Conflating mute with offline creates false lifecycle transitions. A brief mute would make
selectors flicker to “waiting,” make admin on-air counts drop, invite consumers to tear down
and rebuild, and suggest that the interpreter left. The media model intentionally preserves
the Producer and its Consumers through a mute (`apps/server/src/core/media/room.ts:50-60`,
`apps/server/src/core/media/peer.ts:59-67`). That keeps reconnection work out of an ordinary
control action and preserves listener counts.

Conversely, omitting mute from the actual Listener experience makes real silence ambiguous.
A Listener cannot distinguish an intentional pause from a broken device or media path. The
listener state machine keeps `muted`, `interpreter-away`, `reconnecting`, and `media-trouble`
distinct and gives each different copy (`apps/web/src/components/guest/listen-state.ts:8-50`,
`apps/web/src/components/guest/listen-state.ts:121-140`). Socket.IO is the appropriate
boundary because this status changes during an active session and must arrive immediately;
REST lists need only the stable operational question “does a Producer exist?”

The distinction also keeps authorization and runtime state honest. Enabled controls
reachability, the claim controls who may produce, Producer existence controls Live/online,
Producer pause controls Muted, arming records Listener intent, and an open locally unpaused
Consumer controls Listening. Each state has one owner and one meaning.

## When to Apply

- Adding or changing public Event/Channel endpoints, admin live endpoints, or their DTOs.
- Changing mediasoup Producer creation, pause, resume, close, or replacement behavior.
- Changing Socket.IO Channel membership or Producer lifecycle notifications.
- Building selector, dashboard, Listener, or Speaker copy that says “On air,” “Waiting,”
  “Muted,” or “Listening.”
- Adding reconnect behavior, where a fresh Socket.IO snapshot must replace stale mute
  information.

This does not imply that every realtime screen must display mute. A list whose decision is
“which Channels have an interpreter producing?” should project `online` and ignore mute. A
screen where a person is already trying to hear the Channel should use the Socket.IO mute bit
to explain why a Live Channel is silent.

## Examples

**Muted but Live.** A Speaker has a Producer and invokes `media:pause-producer`. The server
pauses it and publishes `producer-paused` without removing it
(`apps/server/src/core/media/index.ts:272-285`). `isOnline()` remains true, while
`channelStatus()` becomes `{ online: true, muted: true }`. This invariant is pinned at the
Room layer (`apps/server/src/core/media/room.test.ts:100-137`) and through the socket media
handlers (`apps/server/src/socket/handlers/media.handlers.test.ts:244-255`). Public and admin
lists continue to show the Channel on air; joined Listeners receive the mute change.

**Claimed but not Live.** A Speaker completes the handshake and takes the presence claim but
has not pressed Go live. The claim exists while no Producer exists, so `online` is false. The
join-handler test guards this distinction
(`apps/server/src/socket/handlers/channels.handlers.test.ts:47-60`).

**Armed before Live.** A guest taps to listen while `online` is false. Arming is retained, but
no Consumer is opened until a Producer appears; the Listener computes its consumer plan from
the armed Channel and `live && connected`
(`apps/web/src/components/guest/listener-room.tsx:82-121`). When a Producer opens, Socket.IO
changes the status to online and consumption starts automatically.

**Listener count during mute.** A guest has resumed their Consumer and is Listening. The
Speaker pauses the Producer. The Consumer remains open and locally unpaused, so the count
remains one; the regression test fixes that behavior
(`apps/server/src/core/media/room.test.ts:226-235`). Admin can still report “On air · 1
listening” without needing a mute field (`apps/web/src/lib/format.ts:37-45`).

**Regression checks.** Preserve tests at three boundaries:

- At the media layer, assert pause leaves `isOnline()` true and changes only
  `channelStatus().muted` (`apps/server/src/core/media/room.test.ts:112-137`).
- At the socket layer, assert joining a paused Producer returns
  `{ online: true, muted: true }` and pause/resume events keep `online` true
  (`apps/server/src/socket/handlers/channels.handlers.test.ts:81-103`,
  `apps/server/src/socket/handlers/lifecycle.handlers.test.ts:156-187`).
- At the client boundary, assert HTTP online maps to unknown mute and selector projection is
  identical for muted and unmuted Live Channels
  (`apps/web/src/lib/channel-status.test.ts:13-17`,
  `apps/web/src/lib/channel-status.test.ts:55-65`).

When REST contracts change, also verify that `PublicChannel` and `AdminLiveChannel` remain free
of `muted` unless a separately approved product requirement deliberately moves that boundary.

## Related

- [Diagnosing live audio from a user's description, with no monitoring stack](../operations/diagnosing-live-audio-from-a-user-report.md)
  complements this convention for silence not explained by an intentional mute.
- [An identifier returned to a client is not a capability](an-identifier-returned-to-a-client-is-not-a-capability.md)
  is the sibling convention for authorizing Producer mutations.
- [PR #1](https://github.com/simon-vajda/linguacast/pull/1) contains the implementation and
  regression tests that established this boundary.
