# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Specs A and B are implemented: a pnpm workspace with `packages/contract`, `tools/openapi-codegen`, an API-only-plus-SPA `apps/server`, and `apps/web` — a React SPA scaffold whose one route renders `GET /api/version` through the generated contract types. There is no mediasoup and no product UI yet — the interpretation features themselves are still intended design, not existing implementation. Keep this file current as decisions are made.

## Layout and commands

- `packages/contract` — hand-written Zod schemas and `createRoute()` definitions. **Never built:** every export points at TypeScript source, and consumers compile it. Its tsconfig sets `"types": []` with no DOM on purpose (the React Native seam) — a `node:`/DOM import in `src` must fail to compile there.
- `tools/openapi-codegen` — a private workspace package whose only job is holding `typescript@5.9.3`. `openapi-typescript` emits its output with the `ts.factory` AST API, which TypeScript 7.0 does not expose (a programmatic API returns in 7.1). The package exposes an `openapi-codegen` bin that runs openapi-typescript's own CLI in-process from its TypeScript 5 resolution scope, and `packages/contract` depends on it — so the arrow points `contract → openapi-codegen` and the tool knows nothing about the contract's layout. TypeScript 5 therefore appears in exactly one `package.json` and is not reachable as a binary from any package that compiles source; `pnpm why -r typescript` is the mechanical form of that invariant. Every real package pins `typescript@7.0.2`. **Exit condition:** when TypeScript 7.1 ships its programmatic API and `openapi-typescript` adopts it, delete `tools/` and move `openapi-typescript` into `contract`'s devDependencies.
- `apps/server` — Hono + `@hono/zod-openapi`. `app.ts` builds the app without listening; `index.ts` owns the listener. `lib/problem.ts` stays transport-agnostic so the signalling layer can reuse it. `defaultHook` must be passed to *every* `OpenAPIHono` instance that registers routes — it is not inherited by sub-apps.
- `apps/web` — Vite 8 + React 19 SPA. TanStack Router with **file-based** routing: a file under `src/routes/` *is* a route, and the Vite plugin regenerates `src/routeTree.gen.ts` on dev-server startup and on every change there. That file is generated **and committed** (typechecking runs before any build) but has no drift tripwire — a stale route tree is immediately visible as a missing page, unlike a stale `api.d.ts`. It is excluded from Biome. `src/components/ui` is the shadcn CLI's target and is **never hand-edited**; re-run `pnpm dlx shadcn@latest add <name>` from `apps/web`, then `pnpm check:fix` (the CLI's formatting differs from Biome's). `tsconfig.json` must **not** declare `baseUrl` — TypeScript 7 removed the option; `paths` alone resolves for both `tsc` and the shadcn CLI. `src/api`, `src/signal`, and `src/state` are the portable directories that lift into `packages/client-core` when the Expo app begins; **everything else under `apps/web/src` is web-only.**
- Route paths are declared **without** the `/api` prefix; the prefix lives in the document's `servers` entry and the server's mount point.
- `packages/contract/openapi.json` and `src/generated/api.d.ts` are generated **and committed**. Run `pnpm gen` after any schema or route change; CI fails on drift.
- Node **24** (active LTS), pinned in `.nvmrc` and floored by `engines.node`. Deliberately LTS rather than Current: mediasoup is a native addon and those track LTS releases far more reliably.
- Commands: `pnpm dev` (three processes — contract's gen watcher, the server on 3000 under `tsx watch`, Vite on 5173 proxying `/api` to 3000), `pnpm gen`, `pnpm build` (contract gen → web build → server build → copy web's `dist` into `apps/server/dist/public`, producing a single bundle that serves both the API and the SPA), `pnpm typecheck`, `pnpm check`. No test runner is configured yet, so `pnpm test` is a no-op.
- `@hono/zod-openapi` is pinned to exactly `1.4.0`. Do not float it: 1.5.x has broken type declarations that silently degrade every schema type to `any` under `skipLibCheck`, voiding the handler/contract compile-time guarantee.

## What LinguaCast is

A self-hosted, open-source platform for simultaneous interpretation at live in-person events — church sermons, international conferences, talks. An interpreter speaks into their phone or laptop; guests in the room listen live on their own devices. Low audio latency is the core product requirement.

## Deployment context (drives most design decisions)

Deployed on small servers run by churches and educational institutions, not in a central cloud. Expected load: a handful of concurrent events, listeners in the tens to low hundreds. **Optimize for simplicity of operation and setup over scalability.** Horizontal scaling, multi-tenancy, sharding, and cloud-managed dependencies are explicitly out of scope. A single-process server that an admin can run on modest hardware is the target.

## Domain model

- **Admin** — the only authenticated account in the system. Single user. Creates and edits events, manages app settings, shares links.
- **Event** — e.g. "Sunday Service". Owns one or more channels.
- **Channel** — typically a target language, e.g. "English", "Spanish". One speaker, many listeners.
- **Speaker code** — generated when an event is created. The speaker link for an event's channel opens a page for broadcasting to that channel's listeners.
- **Listener link / QR code** — takes a guest directly to an event; they pick a channel and listen.

## Access model

Only the admin authenticates. Speakers and listeners are authorized purely by possession of their link/code — no accounts, no signup, no login. This is deliberate: the friction of authentication would defeat the product. Admin sets up, shares two links, everyone starts using it. Preserve this property when designing new features; if something seems to need listener identity, question the requirement first.

## Intended stack

- **Server** — Node.js with [mediasoup](https://mediasoup.org/) as the WebRTC SFU. Audio-only.
- **Web frontend** — React SPA. This is the only client for now.
- **Mobile** — likely Expo / React Native, planned but not started. Avoid decisions that would lock the API to a browser-only client.

## Working in this repo

Detailed architecture has not been discussed yet — signaling protocol, persistence, room/transport lifecycle, and settings storage are all open. When those are settled, record them here rather than leaving them implicit in code.

`docs/superpowers` is gitignored on purpose — it is local-only scratch material, not part of the repo. Never stage or commit it, and don't "fix" its absence from git.
