---
title: Hosting
description: How the Hallspeak server fits together on your network, trusting your proxy, sizing cores and ports, and running on a dynamic IP address.
---

## How it fits together

Two paths reach the container, and only one of them goes through your proxy. Almost
every deployment failure is a confusion between them.

- **Pages and signalling** go through the proxy over HTTPS.
- **Audio never touches the proxy.** It goes straight to the forwarded RTC ports.
- **`/data` is all of your state.** Its `logs/` subdirectory is diagnostics, not state.

## `TRUSTED_PROXY_IPS`

Hallspeak believes `X-Forwarded-For` only from connections arriving from a listed
address — an exact list, not CIDR. The value is the address **the container sees the
proxy connect from**.

Container addresses can move on recreate, so pin the proxy's address if this must
survive unattended.

## Cores, events and ports

One event runs on one CPU core, start to finish. `MEDIA_MAX_WORKERS` (default 4) is how
many cores Hallspeak may use, so it sets how many events run in parallel and limits a
crash to the events on one core — it never makes a single event bigger. It is capped by
the host's core count; if you only run one event at a time, `1` is honest.

Each core in use needs one port, counting up from `MEDIA_RTC_PORT_BASE` (44400). If you
change either setting, edit the port ranges in `compose.yaml` and your router forwarding
to match; Compose cannot derive a range from a variable.

## Dynamic IP addresses

Dynamic DNS is supported. Point a DDNS name at your connection and set `PUBLIC_ADDRESS`
to it. Hallspeak re-resolves the name every minute, so when your IP changes new
connections use the new address without a restart, and connected guests reconnect on
their own within seconds.

