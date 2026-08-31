---
title: Offer both address forms, because Firefox drops hostname ICE candidates and IPv6-only carriers need them
date: 2026-08-29
category: integration-issues
module: apps/server
problem_type: integration_issue
component: media
severity: high
symptoms:
  - "Audio works in Chrome on every platform and never works in Firefox"
  - "media: recv transport has no nominated candidate pair after 5000ms in the browser console"
  - "The server logs a transport still new/connecting after 5000ms for the Firefox session only"
  - "Every signalling call succeeds and no error appears on either side"
applies_when:
  - "PUBLIC_ADDRESS is a hostname rather than an IP address"
  - "Deploying behind a dynamic-DNS name on a home connection"
root_cause: browser_incompatibility
resolution_type: code_fix
tags:
  - mediasoup
  - webrtc
  - ice
  - firefox
  - dynamic-dns
---

## Problem

A deployment with `PUBLIC_ADDRESS` set to a DDNS hostname carried audio in Chrome on
macOS and Android, including over mobile data, and carried none in Firefox. The only
signal was the browser-side diagnostic: the receive transport had no nominated candidate
pair after five seconds. Nothing threw, on either side.

## Cause

An ICE candidate carries a connection address. mediasoup will put whatever
`announcedAddress` holds into that field, hostname included. Chrome resolves a remote
candidate that names a host; Firefox discards it — [bug 1713128][fqdn] is still open, and
per RFC 8839 Firefox is the conforming one.

Mozilla's note on [bug 1712975][note] says such a setup survives only because the server's
ICE agent can reach the browser first and form a peer-reflexive candidate. mediasoup is
ice-lite: it never sends a connectivity check. So Firefox discarded every candidate it was
offered and had nothing left to pair with, which is exactly "no nominated candidate pair"
and is indistinguishable from a blocked port or a privacy extension.

[fqdn]: https://bugzilla.mozilla.org/show_bug.cgi?id=1713128
[note]: https://bugzilla.mozilla.org/show_bug.cgi?id=1712975

## Resolution

The server resolves the name so that Firefox never has to. `core/media/announced-address.ts`
resolves `PUBLIC_ADDRESS` to an IPv4 address at startup, fatally if it cannot, and
re-resolves it every minute.

The literal is **added** to the candidate list rather than substituted for the name.
mediasoup announces `PUBLIC_ADDRESS` verbatim, and `augmentCandidates` in
`core/media/config.ts` derives a literal-addressed twin of every candidate — same
protocol, port and TCP type, its own foundation, and a priority lifted clear of every
hostname candidate so a client that can use either tries the literal first. `createTransport` applies it, so
the append is a media-domain decision and costs no extra port.

Substituting the literal, which is what this write-up originally described, cost the
deployment its other half: a phone on an IPv6-only carrier has no IPv4 candidate of its
own and reached the server only by resolving the name through DNS64 to a NAT64 address.
Removing the DNS step removed that path, and it showed up only on a mid-session network
handoff — a fresh page load re-enumerates interfaces and can pick up Android's 464XLAT
IPv4, while an ICE restart re-gathers on a peer connection that still holds the old view.
See `recover-a-chromium-listener-whose-page-cannot-see-the-new-network.md`.

Because the announced value is now the configured one, it never moves. A polled address
change re-runs the STUN cross-check and nothing else: no `WebRtcServer` is rebuilt and no
room is dropped, and the next transport created simply carries the new literal. The
`address_changed` reset reason is gone with the rebuild it announced.

## Notes

- A second listen info per worker is still not a way out. It would need a second port and
  a hosting-guide change; appending at signalling time needs neither.
- `iceServers` URLs are unaffected: a STUN or TURN URL is a URL, and Firefox resolves it
  normally. Only candidate connection-addresses have this restriction.
- Resolution is IPv4-only on purpose. The workers bind an IPv4 address, so announcing a
  AAAA record would produce candidates pointing at nothing this process listens on.
- Firefox's ICE-TCP has been on by default since Firefox 54 and was never a factor here.
