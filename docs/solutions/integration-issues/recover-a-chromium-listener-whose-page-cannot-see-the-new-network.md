---
title: Recover a Chromium listener whose page cannot see the new network
date: 2026-08-30
category: integration-issues
module: apps/web
problem_type: integration_issue
component: media
severity: high
symptoms:
  - "Audio never returns after a phone hands off from Wi-Fi to cellular, though the socket reconnects"
  - "media: recv transport has no nominated candidate pair after 5000ms, with local candidates present and remote [none] pairs [none]"
  - "Every local candidate is IPv6 while the server announces IPv4 only"
  - "Reloading the page and pressing Listen restores audio immediately"
  - "Firefox on the same phone, network and server reconnects with no interruption"
applies_when:
  - "A listener's device changes network while the page stays open"
  - "The server announces IPv4 candidates only, which is every deployment without working inbound IPv6"
  - "The browser is Chromium-based (Chrome, Brave, Edge) on Android"
root_cause: browser_incompatibility
resolution_type: code_fix
tags:
  - mediasoup
  - webrtc
  - ice
  - chromium
  - android
  - ipv6
---

## Problem

A listener on Wi-Fi switches to cellular. Socket.IO reconnects, the media session
renegotiates, the server creates a transport and a consumer, and no audio ever arrives.
Nothing throws anywhere. The reverse handoff — cellular to Wi-Fi — is unaffected, and so
is loading the page fresh on cellular.

## Cause

The browser-side diagnostic said it: local candidates present, `remote [none] pairs
[none]`. Chrome emits `remote-candidate` statistics only for candidates it has paired, so
zero pairs means nothing could pair. Every local candidate was a cellular IPv6 host
address; every candidate the server offered was IPv4. ICE pairs within an address family,
so the transport sat in `new` forever with no error to report.

The IPv4 path exists the whole time — the same phone on the same network pairs instantly
in Firefox, and a page reload in Chrome recovers within seconds. What Chromium will not do
is see it. Its WebRTC network view is per page: a peer connection created during a handoff
gathers on the interface set that view holds, and every replacement built inside that page
inherits the same view. Only a new document re-enumerates.

That is why the recovery ladder cannot win. An ICE restart re-gathers on the same peer
connection, and a rebuild — a genuinely new `RTCPeerConnection`, after releasing the
direction server-side — gathers the identical IPv6-only set. Three rebuilds over a minute
produced three identical candidate lists.

Neighbouring, and not this bug: [Chromium 40248162][multi] covers Android phones with two
cellular networks (data APN plus IMS APN) sending STUN checks from the wrong source
address. The two-network setup is visible here too — the candidates carry two distinct
prefixes — but there the connection forms and is then killed, rather than never forming.

[multi]: https://issues.chromium.org/issues/40248162

## Resolution

The address-family gap itself is now closed at the source: the server offers both the
configured hostname and the literal it resolves to in every candidate list, so a phone on
an IPv6-only carrier resolves the name through DNS64 and pairs against a NAT64 address
without a reload. See
`announce-a-resolved-address-because-firefox-drops-hostname-ice-candidates.md`. The
reload stays as the last resort for whatever that does not cover — a carrier with no
NAT64 among them — and the mismatch diagnosis below is withheld while any offered
candidate is a name the browser may still resolve.

The media leg gained a terminal health, `failed`, which resolves to the connection line's
existing `lost` state, and the listener screen offers a **Reconnect** control that loads
the page again. That is the only recovery Chromium accepts, and it works on every host and
every browser. It is withheld when a socket error already explains itself: reloading does
not undo a regenerated PIN or a channel taken over by another device.

A tap is unavoidable regardless of how the reload is triggered — after a fresh load the
autoplay policy needs a gesture before audio can start — so an automatic reload would buy
nothing and cost the guest their place on the page.

The recovery ladder that runs first still earns its keep: restart ICE once, then rebuild
the transport, four attempts with backoff, then stop. Restarts fix an ordinary path change
without disturbing the consumers, and stopping is what keeps a phone's radio from being
held awake forever against a connection that cannot form. Two edges are narrower than
that summary: a transport the browser has declared `failed` is rebuilt at once rather than
spending a restart the browser has already proved useless, and a transport whose direction
has never connected is left gathering for longer than a stalled one rather than being
interrupted mid-gather.

## Notes

- Announcing IPv6 alongside IPv4 would fix this case properly — Chromium's cellular IPv6
  candidates would pair on the first try. It was not built, because it is not reliable on
  the deployment shape this project targets: a home server needs an ISP delegation, an
  inbound router rule, an AAAA record, and `enable_ipv6` on the Docker network. Any one
  missing and it does nothing. Revisit it as an opportunistic improvement, never as the
  fix.
- TURN is not an alternative answer here. A relay on an IPv4-only host is exactly as
  unreachable from an IPv6-only candidate set as the SFU is.
- The give-up state has to read as terminal for a second reason: a rebuild sets health back
  to `connecting`, and the effects that re-open a consumer gate on `isLinkUp`. Left at
  `trouble`, the rebuild tears the transport down and nothing ever asks for another.
