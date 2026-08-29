---
title: Announce a resolved address, because Firefox drops hostname ICE candidates
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

The server resolves the name instead of the browser. `core/media/announced-address.ts`
resolves `PUBLIC_ADDRESS` to an IPv4 address at startup, fatally if it cannot, and
re-resolves it every minute. mediasoup only ever sees a literal address.

A hostname stays the right thing to configure — that is what makes a changing public IP
survivable — so the resolution had to keep running rather than happen once. When the
address moves, `WorkerPool.setAnnouncedAddress` rebuilds each worker's `WebRtcServer` on
the new one: `announcedAddress` lives in the listen infos and is fixed when the server is
created, and a `WebRtcServer` cannot be created before the old one releases the port. The
rooms on that worker are dropped first and clients renegotiate through the existing
`media:reset` path — the same recovery a dead worker gets. Those sessions were already
dead: when a public address changes, every NAT mapping behind it has gone with it.

There is no opt-out: announcing the name verbatim only helps when the client's resolver
knows better than the server's, and it costs every Firefox guest their audio.

## Notes

- Announcing both a hostname and an address is not a way out. `announcedAddress` is one
  value per listen info, and a second listen info would need a second port per worker —
  and Firefox still needs the address, so the hostname candidate buys it nothing.
- `iceServers` URLs are unaffected: a STUN or TURN URL is a URL, and Firefox resolves it
  normally. Only candidate connection-addresses have this restriction.
- Resolution is IPv4-only on purpose. The workers bind an IPv4 address, so announcing a
  AAAA record would produce candidates pointing at nothing this process listens on.
- Firefox's ICE-TCP has been on by default since Firefox 54 and was never a factor here.
