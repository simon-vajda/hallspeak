---
title: Empty-bodied HTTP errors resolved as successful mutations in the admin SPA
date: 2026-08-14
category: integration-issues
module: apps/web
problem_type: integration_issue
component: frontend_stimulus
severity: high
symptoms:
  - "A 502 or 504 from the reverse proxy resolved as a successful mutation instead of throwing"
  - "Optimistic React Query writes kept their optimistic value and rollback never ran"
  - "The admin UI reported an event or channel change the server never accepted"
  - "An offline browser or a refused connection produced no user-visible error at all"
root_cause: wrong_api
resolution_type: code_fix
related_components:
  - "apps/server"
  - "packages/contract"
tags:
  - openapi-fetch
  - openapi-react-query
  - tanstack-query
  - optimistic-updates
  - error-handling
  - fetch-middleware
  - admin-ui
---

# Empty-bodied HTTP errors resolved as successful mutations in the admin SPA

## Problem

`openapi-fetch` hands back a falsy `error` for a non-ok response whose body is empty, and `openapi-react-query` only throws `if (error)` — so a 502/504 from a reverse proxy, which is exactly what a browser sees when the Node server is down, resolved as a **successful** mutation. Optimistic admin writes kept their optimistic value and no rollback ran.

## Symptoms

The server is down (or restarting behind a proxy). An admin toggles an event's enable switch: the switch stays in its new position, no error line appears, and the settle refetch fails silently — the screen reports a change the server never accepted. `apps/web/src/components/admin/event-enabled-switch.tsx:28-31` is where rollback and the failure flag live, and neither ran.

The failure was not uniform, which is what made it confusing. The create/edit form (`apps/web/src/components/admin/event-dialogs.tsx:126-135`) did report failure — but only by accident: it dereferences `saved.id`, and `saved` was `undefined`, so a `TypeError` landed in its `catch`. Delete and regenerate-PIN, which ignore the resolved value, reported success outright.

The second, related hole: a fetch that rejects with no response at all (offline, connection refused) surfaced the browser's raw `TypeError` — an error, so the error path did run, but carrying no code a caller could read.

## Solution

Two commits, `89a2a7a` then `a6f6a38`, landed on `main` with the `feat/admin-events-screens` branch.

An `openapi-fetch` middleware synthesizes a Problem-shaped body for both cases, so both re-enter the normal error path. Before, `apps/web/src/api/client.ts` was just the client construction:

```ts
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });
export const $api = createQueryClient(fetchClient);
```

After (`apps/web/src/api/client.ts:14-45`, trimmed of its comments):

```ts
function unavailable(status: number, message: string) {
  return new Response(JSON.stringify({ code: 'unavailable', message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

fetchClient.use({
  async onResponse({ response }) {
    if (response.ok || (await response.clone().text()) !== '') return;

    return unavailable(response.status, `The server returned ${response.status}.`);
  },

  onError() {
    // 503 is this client's own word for it: no status ever arrived to report.
    return unavailable(503, 'The server could not be reached.');
  },
});
```

`89a2a7a` also fixed the two things the bug had been masking downstream: rollback now snapshots one event's row rather than the whole list (`apps/web/src/lib/admin-queries.ts:69-90`), so a failing toggle no longer reverts a second toggle in flight beside it; and `ConfirmDialog` refuses to close while its mutation is pending (`apps/web/src/components/admin/confirm-dialog.tsx:71-79`), because its inline error line (`:104-108`) is the only report a failed delete or regenerate gets.

## Why This Works

Verified against the installed sources — `openapi-fetch@0.17.0` and `openapi-react-query@0.5.4` (`apps/web/package.json`); this is version-sensitive behavior.

Line numbers below are into the installed dependencies' built `dist/index.mjs`, not repo files — they move between releases; the versions above are what they were read against.

There are two distinct branches in `openapi-fetch` that both yield a falsy `error`, and the middleware covers both because it tests the body text rather than either condition:

- lines 180-182 — for `204`, a `HEAD`, or `Content-Length: 0`, it returns `response.ok ? { data: void 0, response } : { error: void 0, response }`. An explicit `undefined` error on a failure.
- lines 196-200 — otherwise a non-ok response is read as text and `JSON.parse`d in a `try`; an empty body leaves `error` as the empty string, which is falsy too.

`openapi-react-query`'s mutation function is a bare guard over that value (lines 65-67):

```js
const { data, error } = await fn(path, init);
if (error) {
  throw error;
}
```

Its query path carries the same guard (lines 10-12). So neither branch produces a rejection, and React Query's `onError`/rollback contract is never entered.

The middleware runs before that check: `onResponse` returns a replacement `Response` with a JSON body (applied at `openapi-fetch` lines 160-173), so the non-ok path parses a real object and `if (error)` throws. `onError` is offered the rejected fetch and, per lines 129-149, a returned `Response` clears the pending error and becomes the response — the same JSON body, under a status this client chose since none arrived.

`code: 'unavailable'` is deliberate: server-written Problems keep their own codes, and callers get one shape and one code for "the API never answered".

## Prevention

- Any new API client — a second `openapi-fetch` instance, or the React Native client when `src/api` lifts into `packages/client-core` — must carry this middleware. A client without it reintroduces the bug wholesale, and the failure is silent, not loud.
- On upgrading `openapi-fetch` or `openapi-react-query`, re-read the two spots above: whether a body-less non-ok response still yields a falsy `error`, and whether the hook still guards on `if (error)` alone. If upstream starts throwing on `!response.ok`, the middleware becomes redundant rather than wrong — but check, don't assume.
- Treat "the mutation resolved" as insufficient evidence in optimistic handlers. Where a handler already needs the response (`saved.id`), a bad resolve surfaces; where it doesn't, it cannot.
- A regression test is not currently possible in place: `apps/web` has no test setup — no `test` script and no vitest in `apps/web/package.json`, and no `*.test.*` files under `apps/web/src`. Standing one up, the test is small and does not need a browser: build a client through `createFetchClient` plus the middleware against a stubbed `fetch` returning `new Response('', { status: 502 })`, and assert the mutation function rejects. A second case with a stub that rejects covers `onError`. Both assert `code === 'unavailable'`.

## Related Issues

- First entry in this store; no related learnings yet.
- `apps/web/src/lib/admin-queries.ts` holds the optimistic-write helpers this bug corrupted — the snapshot, rollback and settle contract every admin mutation passes to React Query.
