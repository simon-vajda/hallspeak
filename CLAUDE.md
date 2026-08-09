# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Spec A (foundation) is implemented: a pnpm workspace with `packages/contract`, `packages/codegen`, and an API-only `apps/server` serving `GET /api/version` plus Scalar docs at `/api/docs`. There is no `apps/web` and no mediasoup yet — the interpretation features themselves are still intended design, not existing implementation. Keep this file current as decisions are made.

## Layout and commands

- `packages/contract` — hand-written Zod schemas and `createRoute()` definitions. **Never built:** every export points at TypeScript source, and consumers compile it. Its tsconfig sets `"types": []` with no DOM on purpose (the React Native seam) — a `node:`/DOM import in `src` must fail to compile there.
- `packages/codegen` — tool-only package holding `openapi-typescript` and the TypeScript 5 it peer-depends on. TypeScript 7 does not expose the `ts.factory` API that tool needs, so it is isolated here; everything that typechecks source stays on TypeScript 7.
- `apps/server` — Hono + `@hono/zod-openapi`. `app.ts` builds the app without listening; `index.ts` owns the listener. `lib/problem.ts` stays transport-agnostic so the signalling layer can reuse it. `defaultHook` must be passed to *every* `OpenAPIHono` instance that registers routes — it is not inherited by sub-apps.
- Route paths are declared **without** the `/api` prefix; the prefix lives in the document's `servers` entry and the server's mount point.
- `packages/contract/openapi.json` and `src/generated/api.d.ts` are generated **and committed**. Run `pnpm gen` after any schema or route change; CI fails on drift.
- Commands: `pnpm dev`, `pnpm gen`, `pnpm build`, `pnpm typecheck`, `pnpm check`. No test runner is configured yet, so `pnpm test` is a no-op.
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
