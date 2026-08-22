---
title: An identifier returned to a client is not a capability
date: 2026-08-21
category: conventions
module: apps/server
problem_type: convention
component: api
severity: critical
applies_when:
  - "A handler resolves a resource by an id the caller supplies, rather than by something the caller independently holds"
  - "An ack or event payload hands an id (producerId, consumerId, transportId) to every peer who can reach that response"
  - "Adding a verb alongside an existing one that already carries a guard, and sharing its payload type"
  - "Reviewing a handler whose only check is that the named resource exists"
  - "Reading a test file for a security-relevant handler, to ask which dimension it actually varies"
tags:
  - security
  - authorization
  - mediasoup
  - socket-io
  - api-design
  - testing
---


## Context

LinguaCast has no listener accounts. A guest is authorized by possessing the event's
six-digit PIN; a speaker by possessing that channel's speaker code. Everybody in the room
holds a valid credential — that is the normal state, not the attack. Which means the
interesting question is never "is this caller authenticated" but "what does this particular
caller independently hold".

Three socket events take a producer id: `media:pause-producer`, `media:resume-producer` and
`media:close-producer`, all three sharing `MediaProducerPayload`
(`packages/contract/src/socket/contract.ts:64-69`). A fourth event hands that id out:
`media:consume` acks with `producerId` beside the consumer's
(`packages/contract/src/schemas/socket.ts:88-93`, produced at
`apps/server/src/core/media/index.ts:285-290`).

The original implementation resolved the id with a `Room.producerById(id)` — a scan across
every producer on the event — and did nothing else. Chained, that is: a guest consumes a
channel legitimately, reads `producerId` out of their own acknowledgement, and calls
`media:close-producer` with it. The interpreter goes silent mid-service. Because the lookup
was event-wide, the id did not even have to belong to the channel the guest was listening to.

The near-miss is the instructive part. `media:produce` had the correct guard from the
beginning and still does: it resolves the slug against the socket's own event and then
refuses unless the socket holds the claim for exactly that channel
(`apps/server/src/socket/handlers/media.handlers.ts:77-81`). The plan specified that guard
for produce. Its three sibling verbs were written without one, and nothing in the code
connected them. Two independent reviewers flagged it in the review round that produced this
document — which is the encouraging part: the shape is findable by reading, even though the
suite could not catch it.

## Guidance

**An identifier you return to a client is public to everyone who can reach that response.**
The moment an id crosses the wire in an ack, stop treating it as a secret and stop treating
possession of it as evidence of anything. Resolving a resource by a client-supplied id is a
lookup. It is never an authorization.

Authorize by what the caller independently holds, then use the id only to confirm the caller
named the thing they were already entitled to. Concretely, the producer verbs now derive the
channel from the caller's own claim before any lookup happens:

- `claimedChannel(auth)` in `apps/server/src/socket/handlers/media.handlers.ts:94-99` returns
  `auth.speakerChannelId` or throws `not_speaker` when it is `null`. It is not optional —
  each of the three verbs passes through it
  (`media.handlers.ts:106`, `:115`, `:124`). A listener's auth carries
  `speakerChannelId: null` by construction (`apps/server/src/core/access.ts:56`), so a
  listener cannot reach the lookup at all.
- `producerOrThrow(ctx, channelId, producerId)` in
  `apps/server/src/core/media/index.ts:377-383` fetches the producer **for that channel** and
  only then compares ids, throwing `no_producer` on a mismatch. `closeProducer`
  (`index.ts:223-233`) does the same, returning quietly on a miss because a close that finds
  nothing has already got what it asked for.
- `Room.producerById` was **deleted**. `Room` now exposes only `producer(channelId)`
  (`apps/server/src/core/media/room.ts:41-43`). The by-id-across-the-event lookup no longer
  exists to be reached for, which is a stronger guarantee than a comment asking future code
  not to use it.

**When one verb in a family gets a guard, the others need it or a written reason why not.**
The asymmetry here was invisible because the guard lived inside one handler as an `if`. The
way to make it automatic is the shape above: derive the scope from the caller's own authority
and pass it into the lookup, so a verb that forgets the guard cannot compile — there is no
call signature that takes a producer id without a channel id beside it.

## Why This Matters

Silencing an interpreter mid-sermon is the worst thing this system can do. Rated P0 for that
reason, not because the exploit is clever — it needs no tooling beyond the browser console
of a page the attacker was legitimately handed.

The test suite could not have caught it, and the reason generalizes. `media.handlers.test.ts`
drove pause, resume and close only from a speaker socket, and its only negative case was a
made-up producer id — which failed, but for the wrong reason: no such producer, rather than
not authorized. A green test asserting the right outcome from the wrong cause is worse than
no test, because it reads as coverage. **The authorization dimension was never varied**, so
no amount of running the suite would have surfaced it.

The fix therefore includes the tests that were missing, under a describe block named for the
property rather than the function (`media.handlers.test.ts:264-309`): a listener is refused
each of the three verbs while holding the genuine producer id, and a speaker on Spanish is
refused English's producer with `no_producer`. Each negative case also asserts
`isOnline(eventId, englishId)` is still `true` — the refusal has to be a refusal, not a
half-executed close.

## When to Apply

- Any handler whose payload names a resource the server also hands out in a response.
- Any endpoint reachable by a credential many people hold at once — a shared PIN, a link, a
  QR code, a team token. The broader the credential, the less an id proves.
- Whenever a plan or review specifies a guard for one operation and the same payload type is
  shared by its siblings. Grep for the payload schema, not the handler name.
- Reviewing a test file for a security-relevant handler: ask which dimension is varied. If
  every case comes from the same caller identity, the file tests behavior, not authorization.

## Examples

The unsafe shape, and why it reads as fine:

```ts
// The id came from the client, so we look it up. Nothing else is checked.
const producer = room.producerById(payload.producerId);
producer.close();
```

Nothing in those two lines mentions authorization, which is exactly the problem: there is no
place where a reviewer's eye expects a check to be missing.

The safe shape puts the caller's authority in the call signature:

```ts
export async function stopProducing(socket, auth, payload: { producerId: string }) {
  await media.closeProducer(ctx(socket, auth), claimedChannel(auth), payload.producerId);
  return {};
}
```

`claimedChannel(auth)` throws before the lookup runs, and `closeProducer` cannot be called
without a channel scope because the parameter is required
(`apps/server/src/core/media/index.ts:223-227`). The client-supplied id has been demoted from
"what to act on" to "confirm this is the one I mean".

Note what stayed the same and why. The consumer verbs — `resumeConsuming` and `stopConsuming`
(`media.handlers.ts:141-157`) — still resolve by id alone, because they resolve it *within
the caller's own peer*: `peerOrThrow(ctx)` is keyed on `ctx.socketId`
(`apps/server/src/core/media/index.ts:367-371`), so the scope is the socket itself and a
foreign consumer id finds nothing. Same principle, different scope. The rule is not "never
look up by id" — it is "the scope of the lookup must come from the caller, never from the
payload".

## Related

- `AGENTS.md` — the "Access model" section is what makes this class of defect load-bearing
  here: possession is the whole credential, so ids must not become credentials by accident.
- `docs/solutions/conventions/identical-404s-for-disabled-and-nonexistent-resources.md` — the
  sibling rule on the HTTP side. Both come from the same premise: with no accounts, every
  response is read by someone you did not choose.
- `apps/server/src/socket/handlers/media.handlers.test.ts:264-309` — the tests whose absence
  let this ship.
