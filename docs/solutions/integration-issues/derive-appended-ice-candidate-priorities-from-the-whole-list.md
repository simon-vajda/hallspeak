---
title: Derive an appended ICE candidate's priority from the whole list, not from its own source
date: 2026-08-31
category: integration-issues
module: apps/server
problem_type: integration_issue
component: media
symptoms:
  - "Two candidates in one ICE list carry the same priority"
  - "The TCP literal candidate ties with the UDP hostname candidate instead of outranking it"
  - "A per-candidate priority test passes while the ordering guarantee it exists to prove is broken"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [mediasoup, webrtc, ice, candidate-priority]
---

# Derive an appended ICE candidate's priority from the whole list, not from its own source

## Problem

`augmentCandidates` adds a literal-addressed twin of every ICE candidate so a DDNS
deployment can offer both a hostname and an IP address (see
`announce-a-resolved-address-because-firefox-drops-hostname-ice-candidates.md`). The twins
have to outrank the hostname candidates, or a client that can use either spends its first
connectivity check on the name it may have to resolve. Deriving each twin's priority as
`source.priority + 1` does not achieve that.

## Symptoms

- Two candidates in the returned list share a priority value.
- The TCP twin lands on exactly the UDP source's priority rather than above it.
- The obvious test — each twin outranks *its own* source — passes anyway.

## What Didn't Work

`priority: candidate.priority + 1`. It reads as correct and is correct for a single
candidate, which is why it survived implementation and only fell out of review.

## Solution

Lift every twin clear of every source by the span of the input priorities:

```ts
const priorities = candidates.map((candidate) => candidate.priority);
const lift = Math.max(...priorities) - Math.min(...priorities) + 1;
const twins = sources.map((candidate) => ({
  ...candidate,
  foundation: `${candidate.foundation}2`,
  priority: candidate.priority + lift,
  ip: address,
  address,
}));
```

The span keeps the sources' relative order among the twins while putting all of them above
all of the names.

## Why This Works

mediasoup gives one worker's UDP and TCP candidates **adjacent** priorities — 1076302079
and 1076302078 for a single listen-info pair. A `+1` increment therefore walks the TCP twin
straight onto the UDP source's value: duplicate priorities in one list, and the TCP literal
tied with a hostname rather than ranked above it. The offset has to clear the whole list
because the list is the thing being ordered, not each pair independently.

## Prevention

- When deriving a value that must order against a **set**, compute the offset from the set,
  not from each element. A per-element increment only orders each element against itself.
- Assert the property you actually want. `twin > its own source` is weaker than
  `every twin > every source, and no two candidates tie` — write the second, which is what
  `config.test.ts` now does:

```ts
const highestName = Math.max(...names.map((c) => c.priority));
expect(literals.every((c) => c.priority > highestName)).toBe(true);
expect(new Set(candidates.map((c) => c.priority)).size).toBe(candidates.length);
```

- The failure is silent at every layer: mediasoup-client copies the array into SDP verbatim
  and validates nothing, and a tie costs an extra connectivity check rather than an error.
  Only the assertion catches it.

## Related Issues

- `announce-a-resolved-address-because-firefox-drops-hostname-ice-candidates.md` — why both
  address forms are offered at all.
- Observed on mediasoup 3.24.2.
