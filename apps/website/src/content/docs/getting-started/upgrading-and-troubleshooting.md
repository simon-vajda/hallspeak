---
title: Upgrading and troubleshooting
description: Upgrade the Hallspeak server, find the cause of a deployment that loads but plays no audio, and read the server log.
---

## Upgrading and backups

Set `HALLSPEAK_VERSION` in `.env` to the new release. If that release's `compose.yaml` or
`.env.example` differs from yours, carry the changes over first. Then:

```sh
docker compose pull && docker compose up -d
```

Migrations run at boot; the data directory is untouched.

## When it doesn't work

| Symptom                                                                 | Cause                                                                         | Fix                                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Every screen loads, nobody hears anything                               | `PUBLIC_ADDRESS` is wrong, or the RTC ports are not forwarded                 | Check the address in the startup log (or `curl -s https://api.ipify.org`); forward 44400–44403 on **both** UDP and TCP, without remapping |
| The browser won't allow microphone access; signing in does nothing      | Plain HTTP                                                                    | Use the proxy's HTTPS URL, not `http://<host>:3000`                                                                                       |
| Container exits with `/data is not writable`                            | Read-only mount, or a uid that does not own the directory                     | Drop `:ro`; set `PUID`/`PGID` to the owner, or `chown` it on the host if you set Docker's `user:` yourself                                |
| A correct password is refused after a few tries                         | `TRUSTED_PROXY_IPS` unset behind a proxy                                      | See [`TRUSTED_PROXY_IPS`](/getting-started/hosting/#trusted_proxy_ips)                                                                                             |
| Everyone shares one throttle bucket although `TRUSTED_PROXY_IPS` is set | Proxy not appending `X-Forwarded-For`, or connecting from an unlisted address | The log warns once about each, naming the address it saw                                                                                  |
| Only listeners on your own LAN hear nothing                             | Router lacks NAT hairpinning                                                  | Split-horizon DNS on the LAN                                                                                                              |
| Container exits naming private or loopback addresses                    | Hostname answered by a LAN resolver                                           | Set `PUBLIC_ADDRESS` to your public IP, or give the container a public resolver                                                           |
| Audio breaks for some listeners, not others                             | Not a deployment fault                                                        | [`diagnosing-live-audio-from-a-user-report.md`](https://github.com/simon-vajda/hallspeak/blob/main/docs/solutions/operations/diagnosing-live-audio-from-a-user-report.md)                         |

A guest on a network blocking **both** UDP and TCP to the RTC ports — some corporate and
hotel networks — cannot receive audio.

## Reading the log

`docker compose logs hallspeak` is written to be pasted into a bug report as-is. The
default `info` level costs the same handful of lines whether five people listened or five
hundred; a broken deployment is louder on purpose, warning once per listener whose
connection carried no audio.

If asked for more, raise `LOG_LEVEL` to `debug`, recreate the container, reproduce the
problem, then set it back. **`trace` adds the network addresses of the people
listening**, both on screen and in `/data/logs`, where it stays for the 14-day retention
window — read an excerpt before you share it.

Docker discards a container's output when an upgrade recreates it, so Hallspeak keeps its
own copy in `/data/logs` (`hallspeak.<date>.<n>.log`, one JSON object per line). Set
`LOG_DIR` empty to decline it.
