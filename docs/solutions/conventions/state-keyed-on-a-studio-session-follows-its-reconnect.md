---
title: State keyed on a studio session must follow that session's reconnect
date: 2026-09-12
category: conventions
module: apps/server
problem_type: convention
component: api
severity: high
applies_when:
  - "A server-side record is authorised by a studio session but also stores the socket id it arrived on"
  - "A disconnect handler looks records up by socket id to cancel or release them"
  - "Adding a second registry beside core/presence.ts that holds per-studio state"
  - "Reviewing a reconnect path where the old socket's disconnect can arrive after the new socket's handshake"
tags:
  - socket-io
  - reconnect
  - presence
  - handover
  - studio-session
  - concurrency
---

# State keyed on a studio session must follow that session's reconnect

## Context

A speaker studio identifies itself with a studio session: an opaque id the page generates once and sends in every handshake. Authority belongs to the session, not the socket. A reconnect is the same studio on a new socket. A reload is a different studio.

The server still records socket ids, because a disconnect arrives as a socket id and nothing else. The two facts collide on reconnect. With `pingInterval` and `pingTimeout` at 5 s each (`apps/server/src/socket/index.ts:49-50`), the server can take up to about ten seconds to notice a dropped connection. By then the client has usually reconnected and completed a new handshake. So **the old socket's disconnect routinely arrives after the new socket's handshake**, not before.

`apps/server/src/core/presence.ts` handled this from the start. `registerStudio` moves the broadcast claim to the new socket when the session already holds it (`apps/server/src/core/presence.ts:87-90`), and `release(socketId)` drops the claim only while it still names that socket (`presence.ts:138`). The dying socket's disconnect therefore frees nothing.

`apps/server/src/core/handover.ts` was added beside it and stored `socketId` on both the pending request and the grant. It authorised by session: a granted produce is accepted when `grant.sessionId` matches the caller. But it had no equivalent of the rebind. A code review of the negotiated-handover branch (PR #26) found the resulting defect in two independent passes:

- **Old socket's disconnect lands before the swap completes.** `handover.releaseSocket(oldSocketId)` still matches `grant.socketId`, cancels the grant, and the media layer closes the incoming producer, which the studio's new socket had just opened.
- **It lands after the swap completes.** `complete()` has already moved the claim to `grant.socketId`, the dead socket. `presence.release(oldSocketId)` then matches the claim and drops it. The channel keeps a live producer with no claim holder.
- **A waiting studio that reconnects** loses its request the same way, and with it its place in the countdown.

The whole suite was green. Every handover test used one socket per session, so the socket id and the session id could never diverge.

## Guidance

**Any record that is authorised by a session and stores a socket id must be rebound when that session's new socket registers.** The rebind has to happen at the same point as the claim's rebind, during the handshake, so no disconnect can observe the gap.

The handover registry now does this:

```ts
rebind(studio: StudioSocket): void {
  const state = this.channels.get(studio.channelId);
  if (state?.request?.sessionId === studio.sessionId) {
    state.request.socketId = studio.socketId;
  }
  if (state?.grant?.sessionId === studio.sessionId) {
    state.grant.socketId = studio.socketId;
  }
}
```

(`apps/server/src/core/handover.ts:236-244`). `handshakeGate` calls it straight after `authorizeHandshake`, which is where presence rebinds the claim, and both run synchronously in one tick (`apps/server/src/socket/handshake.ts:27-38`).

Two rules make that rebind sufficient:

1. **A disconnect acts only on records that still name its socket.** `releaseSocket` compares `grant.socketId` and `request.socketId` with the departing socket (`handover.ts:281-293`). After a rebind those no longer match, so the old socket cancels nothing, in whichever order the events arrive.
2. **Anything that later moves authority reads the rebound socket.** `complete()` passes `grant.socketId` to `presence.move` (`handover.ts:264-278`), so the claim lands on the socket that is actually connected.

**Not every registry keyed by socket should rebind.** `apps/server/src/core/reports.ts` keeps the report cooldown per connection on purpose, and its `releaseSocket` simply detaches the socket (`apps/server/src/core/reports.ts:164-173`). A listener has no session, and a reload being a new reporter is the accepted limit. The rule applies where authority is keyed on a session, not wherever a socket id appears.

## Why This Matters

The failures are silent and severe. A cancelled grant sends the incoming interpreter back to pre-flight in the middle of a handover. A claimless live producer means no studio holds the channel it is broadcasting on. Nobody is shown an error, and no log line names the cause.

The trigger is ordinary. A phone switching between Wi-Fi and cellular reconnects its socket, and interpreters hand over on phones and laptops. The ping window makes the late disconnect the normal order, not a rare one.

The defect is also easy to reintroduce. Presence already shows the correct shape, but nothing forces a new registry to copy it. The handover registry authorised by session correctly and still failed, because it treated the socket id as a detail rather than as a second identity that can go stale.

## When to Apply

- Adding a registry that stores `socketId` beside a `sessionId`. Decide explicitly whether a reconnect rebinds it or ends it, and write the test for that decision.
- Any disconnect handler that looks records up by socket id.
- Any code that moves authority (a claim, a grant, a role) to a socket id it read from a stored record.
- Reviewing tests for session-keyed state: if every fixture uses one socket per session, the reconnect dimension is never varied.

## Examples

The test that would have caught it varies the dimension the other tests held fixed. It has the same session, a new socket, then the old socket's disconnect (`apps/server/src/core/handover.test.ts`, `describe('rebind')`):

```ts
it("follows a granted studio's reconnect and moves the claim to the live socket", () => {
  const { registry, presence, cancellations } = live();
  registry.request(waiter);
  registry.confirm(holder, 'producer-out');

  registry.rebind(rebound);
  registry.releaseSocket(waiter.socketId);

  expect(cancellations).toEqual([]);
  registry.produced(rebound);
  registry.complete(CHANNEL_ID);
  expect(presence.claimOf(CHANNEL_ID)).toMatchObject({
    sessionId: waiter.sessionId,
    socketId: rebound.socketId,
  });
  expect(presence.release(waiter.socketId)).toBeNull();
});
```

Pair it with the negative case, which the same block also carries: once the **rebound** socket disconnects, the grant is cancelled. A rebind must not make a record immortal.

## Related

- `docs/solutions/conventions/an-identifier-returned-to-a-client-is-not-a-capability.md`: the handover verbs derive the studio from the caller's own authorisation for the same reason. This doc covers the other half: once authority is keyed on the session, stored socket ids have to follow it.
- `CONCEPTS.md`: **Broadcast claim** (held against the studio's page rather than a connection) and **Handover**.
- PR #26: the negotiated interpreter handover, including the review fix that added `rebind`.
