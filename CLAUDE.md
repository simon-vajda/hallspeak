# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Greenfield. The repository is empty — no commits, no code, no tooling. Everything below is intended design, not existing implementation. Do not assume a build system, package layout, or test runner exists; confirm before referencing one, and update this file as decisions are made.

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
