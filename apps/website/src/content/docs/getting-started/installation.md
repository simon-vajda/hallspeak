---
title: Installation
description: Install the Hallspeak server with Docker Compose behind your own reverse proxy, then prove guests can hear audio.
---

One container behind a reverse proxy you supply. You need `compose.yaml` and
`.env.example` from the [latest release](https://github.com/simon-vajda/hallspeak/releases/latest)
— take them from the release, not from `main`, which can name a version not yet published.
GitHub renames release files that start with a dot, so the release lists it as `env.example`.

## Run it

### 1. Settings

Save `.env.example` as `.env` next to `compose.yaml` and set:

- **`PUBLIC_ADDRESS`** (required) — where guests reach this server for audio: your public
  hostname, usually the one your proxy serves (`hallspeak.example.com`), or your public IP
  if you have none. Audio bypasses the proxy, so this must be reachable from the internet
  on the RTC ports. A hostname is re-resolved every minute, so a dynamic IP behind a
  dynamic-DNS name keeps working — see [dynamic IP addresses](/getting-started/hosting/#dynamic-ip-addresses).
- **`TRUSTED_PROXY_IPS`** (recommended) — the address your proxy connects to the container
  from. Without it, every visitor shares one sign-in throttle bucket. It is rarely the
  address you expect: see [`TRUSTED_PROXY_IPS`](/getting-started/hosting/#trusted_proxy_ips).
- **`HALLSPEAK_DATA_DIR`** (optional) — the host directory holding all of your state.
  Defaults to `./data` beside `compose.yaml`.

Every other setting, with its default and what it does, is documented in `.env.example`.

### 2. Ports

| Port          | Protocol        | Who must reach it                         | Purpose                         |
| ------------- | --------------- | ----------------------------------------- | ------------------------------- |
| `3000`        | TCP             | Only your reverse proxy, not the internet | Web app and API, as plain HTTP  |
| `44400–44403` | UDP **and** TCP | Guests — forward them on your router      | Audio                           |

Port 3000 carries no encryption and serves the setup wizard, so keep it closed to the
internet and let guests in only through your proxy.

To use different ports for audio, don't remap the defaults in `compose.yaml` — the ports
must be the same outside and inside the container. Instead set `MEDIA_RTC_PORT_BASE` in
`.env` and change both port ranges in `compose.yaml` to match. Open one port per worker:
`MEDIA_MAX_WORKERS` ports counting up from `MEDIA_RTC_PORT_BASE` (see
[cores and events](/getting-started/hosting/#cores-events-and-ports)).

### 3. Reverse proxy

Your proxy needs to terminate TLS, pass WebSocket upgrades for `/api/socket.io`, and
append `X-Forwarded-For`. HTTPS is not optional: without it the browser won't allow
microphone access, and signing in fails silently.

**Caddy** does all three unprompted:

```caddy
hallspeak.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**nginx**:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name hallspeak.example.com;
    # ssl_certificate and ssl_certificate_key for your certificate

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_read_timeout 300s;
    }
}
```

**Nginx Proxy Manager** — put it on this service's network (add `networks:` to
`compose.yaml` naming the one NPM is on) and add a Proxy Host: scheme `http`, Forward
Hostname `hallspeak`, Forward Port `3000`, **Websockets Support on**, and on the SSL tab
request a certificate with Force SSL.

### 4. Start it with Docker Compose

```sh
docker compose up -d
```

Then open your HTTPS URL promptly: the setup wizard gives the admin account to whoever
reaches it first.

### Check the logs

```sh
docker compose logs -f
```

Check the media line against what the internet actually sees — a wrong public address is
the one failure that produces no error:

```text
mediasoup: 4 worker(s) of 8 detected core(s) · ports 44400, 44401, 44402, 44403 (UDP and TCP) · guests connect to 203.0.113.10
```

### Alternative: `docker run`

```sh
docker run -d --name hallspeak --restart unless-stopped \
  -e PUBLIC_ADDRESS=hallspeak.example.com \
  -e TRUSTED_PROXY_IPS=172.17.0.1 \
  -p 3000:3000 \
  -p 44400-44403:44400-44403/udp \
  -p 44400-44403:44400-44403/tcp \
  -v /srv/hallspeak/data:/data \
  ghcr.io/simon-vajda/hallspeak:latest
```

`172.17.0.1` is the default bridge gateway, which is what a proxy on the host appears as;
confirm yours with `docker network inspect bridge`. Pin a version tag instead of `latest`
to control upgrades, and add `--env-file .env` to use the remaining settings from
`.env.example`.

## Prove audio works

Loading the page proves nothing. Create an event and a channel, enable both, go live in
the speaker studio, then open the listener page **from a phone on mobile data with Wi-Fi
off** — a listener on your own LAN can succeed or fail for reasons no real guest hits.

