---
title: Return byte-identical 404s for disabled and nonexistent resources
date: 2026-08-17
category: conventions
module: apps/server
problem_type: convention
component: api
severity: high
applies_when:
  - "A public endpoint is addressed by a guessable secret (a PIN, a code, a token)"
  - "Adding a lifecycle flag that makes an existing resource unreachable"
  - "Ordering existence and authorization checks in a lookup handler"
  - "Reviewing a new public route for enumeration leaks"
tags:
  - security
  - enumeration
  - api-design
  - rate-limiting
  - error-responses
---

# Return byte-identical 404s for disabled and nonexistent resources

## Context

A guest reaches an event by PIN — six digits, printed on a QR code and read aloud in a room.
The whole access model rests on possession of that PIN, with no account behind it.

Six digits is a million-wide space, which a script walks in an afternoon. What makes that walk
worthless is that a wrong PIN and a real-but-disabled event have to be indistinguishable. Any
difference — a different status, a different problem `title`, a different response time class —
turns the endpoint into an oracle that confirms which PINs exist, and a PIN that exists is a
PIN that will be enabled again next Sunday.

## Guidance

A disabled event, a disabled channel and a nonexistent PIN produce byte-identical responses.
This is a rule, not a convention: it is enforced by a test in
`apps/server/src/http/routes/events.routes.test.ts`, so a future branch that adds a friendlier
"this event has ended" message fails the suite rather than shipping.

Two consequences that are easy to get wrong:

- **Check existence before the speaker code.** A valid code on a disabled channel still 404s
  and never confirms the code was right. Ordering the authorization check first would leak the
  channel's existence through a 403.
- **Charge the rate limiter on 404 responses only.** Failed public lookups go through an
  in-memory per-IP token bucket (burst 20, refill 1/s) with a smaller global budget behind it.
  A room full of guests never feels it; only a caller that is guessing pays. It throttles and
  never bans — two hundred people in a room share one NAT address.

## Related

- `CLAUDE.md` carries the rule and points here.
- `apps/server/src/http/routes/events.routes.test.ts` — the parity test.
- `apps/server/src/lib/rate-limit.ts` — the token bucket.
