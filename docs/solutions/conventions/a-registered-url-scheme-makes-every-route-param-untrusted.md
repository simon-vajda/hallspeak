---
title: A registered URL scheme makes every route parameter untrusted input
date: 2026-09-07
category: conventions
module: apps/mobile
problem_type: convention
component: frontend
severity: medium
applies_when:
  - "An Expo app declares a `scheme` in app.json, so expo-router accepts deep links into every route"
  - "A route segment is interpolated into a URL, a file path, a shell argument or a storage key"
  - "A parser validates a link on one entry path while a screen reads the same values on another"
  - "Adding a screen under app/ that calls useLocalSearchParams"
  - "Reviewing a client whose users have no accounts, and which therefore looks like it has no attack surface"
resolution_type: code_fix
related_components:
  - apps/mobile/src/links
  - apps/mobile/src/api
tags:
  - expo-router
  - deep-linking
  - input-validation
  - trust-boundary
  - react-native
---

# A registered URL scheme makes every route parameter untrusted input

## Context

`apps/mobile` reaches an event two ways. A guest scans a QR code or pastes a link, and
`parseListenerLink` (`src/links/parse.ts`) checks the scheme, the host, the PIN and the slug
before anything is opened. That parser is careful and well tested, and it is easy to read the
app as though it were the only way in.

It is not. `app.json:8` declares `"scheme": "hallspeak"`, and expo-router registers a deep
link for **every** file under `app/`. So `hallspeak://events/<host>/<pin>` opens the Event
screen directly, from any web page, QR code or chat message, with the parser never on the
path. The screen read those segments raw and handed them to `apiFor(host)`, which reaches
`apiBaseUrl` (`src/api/client.ts:12`):

```ts
export function apiBaseUrl(host: string): string {
  return `https://${host}/api`;
}
```

The whole segment is interpolated into an origin. What made this easy to miss is that nobody
using this client has an account, so it reads as a client with nothing to steal — and the one
piece of validation that existed lived in a module whose name (`links/parse.ts`) suggests it
covers links, which is exactly what a deep link is.

## Guidance

Validate at the screen boundary, with the same rules the parser applies, and return a refusal
rather than a defaulted value:

```ts
// src/links/route.ts
export function readEventParams(host: RouteSegment, pin: RouteSegment): EventParams | null {
  const readHost = firstSegment(host).toLowerCase();
  const readPin = firstSegment(pin);

  if (!isListenerHost(readHost) || !PIN_PATTERN.test(readPin)) {
    return null;
  }

  return { host: readHost, pin: readPin };
}
```

Both route screens now call `readEventParams` / `readChannelParams` and pass the result to
the query as a gate, so a refused route makes no request at all:

```ts
const route = readEventParams(params.host, params.pin);
const query = useQuery({ ...eventQueryOptions(host, pin), enabled: route !== null });
```

Three properties are worth keeping:

- **Null, not a default.** An earlier helper returned `''` for a missing segment, which turned
  a malformed route into a well-formed request for an empty host. A reader that cannot produce
  a valid value must say so.
- **The reader is the only way to get the values.** `readHostSegment` was removed rather than
  left beside the new functions. A validating reader that a call site can bypass is a
  suggestion; being the only export makes it the path of least resistance for the next screen.
- **No request on refusal.** `enabled` keeps a bad address from spending the server's
  per-address rate-limit budget, which a room of guests shares behind one NAT.

## Why This Matters

Without the gate, a link anyone can publish makes the app fetch an attacker's origin, render
its `name` and `description` as the event's own, and write a history row for it. A segment
carrying `%2F` decodes to `/` and injects a path into the origin; `user@host` shifts which
host is actually contacted; a malformed PIN or slug reaches the API as a lookup that can only
fail.

The deeper point is about where the boundary is. Declaring a `scheme` is one line of
configuration in `app.json`, and it silently promotes every route's parameters — present and
future — into external input. The validation a link parser performs does not transfer to them,
because the parser is not on that path. Any framework with file-based routing plus a
registered scheme has this shape.

**What this does not do, and must not be read as doing:** it does not restrict *which* server
the app will talk to. `isListenerHost` (`src/links/host.ts:2`) accepts any well-formed
domain, because Hallspeak is self-hosted and every congregation runs its own origin — and
`parseListenerLink` has always accepted any well-formed host too. Pointing the app at an
unfamiliar server is a property of the product, not a defect. What the reader closes is
malformed input: path and userinfo injection into the origin, bad PINs and slugs, and hosts
whose casing would otherwise split one event across two React Query cache keys.

## When to Apply

Whenever a route parameter leaves the screen that read it — into a URL, a file path, a storage
key, a shell argument, or a query key. The trigger is the interpolation, not the sensitivity of
the app: a client whose users hold no accounts still has an origin it can be pointed at and a
screen that will render whatever comes back.

Apply it also when a codebase has one careful validator and one careless reader for the same
values. That asymmetry is the smell; the fix is to make the careful path the only path.

## Examples

Before — the parser's checks are bypassed entirely on the deep-link path:

```ts
const host = readHostSegment(params.host);   // returns the raw segment, '' when missing
const pin = params.pin ?? '';
const query = useQuery(eventQueryOptions(host, pin));
```

After — the same rules, applied where the values enter:

```ts
const route = readEventParams(params.host, params.pin);
const host = route?.host ?? '';
const pin = route?.pin ?? '';
const query = useQuery({ ...eventQueryOptions(host, pin), enabled: route !== null });

if (route === null) {
  return <ErrorState title={BAD_ROUTE_MESSAGE.title} body={BAD_ROUTE_MESSAGE.body} icon="badLink" />;
}
```

Verified on an Android device: `hallspeak://events/a.example/12` reaches the refusal screen
with no network request and no history row written, while a real event and channel still load.

## Related

- `docs/solutions/conventions/an-identifier-returned-to-a-client-is-not-a-capability.md` — the
  server-side counterpart: resolving a resource by a caller-supplied id is not authorization.
  Same failure shape, opposite end of the wire.
- `docs/solutions/conventions/identical-404s-for-disabled-and-nonexistent-resources.md` — why a
  refused public lookup costs a rate-limit token, which is why the gate withholds the request
  rather than letting it fail.
