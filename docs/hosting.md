# Hosting LinguaCast

LinguaCast runs as a single container behind a reverse proxy you already own. This
guide takes you from nothing to an event whose audio reaches a phone on mobile data.

It assumes you run other self-hosted services and are comfortable editing a Compose
file and forwarding a port on your router. It does not assume you have read the
source.

## Before you start

Three things must be true. None of them is optional, and each fails in a way that is
hard to recognise afterwards.

**A reverse proxy terminating TLS.** The app must be served over HTTPS. Browsers
refuse microphone access on a plain-HTTP origin, so the speaker studio cannot go
live, and the admin session cookie is a `__Host-` cookie the browser discards without
TLS, so signing in fails with no error. nginx, Nginx Proxy Manager and Caddy are all
configured below.

**A public address, and router forwarding for the RTC ports.** Audio does not travel
through your reverse proxy. Guests connect straight to the container's media ports,
so your router must forward ports 44400–44403 on **both UDP and TCP** to the host
running the container. That address also has to be stable enough to put in a config
file — a residential IP that changes silently breaks audio until you restart the
container with the new value.

**A host on Linux kernel 6 or newer.** The published image carries mediasoup's
kernel-6 worker build. An older NAS kernel needs an image built locally, which this
guide does not cover.

While the package is private you also need to authenticate before pulling:

```sh
docker login ghcr.io -u <your-github-username>
```

Use a personal access token with `read:packages` as the password. Making the GHCR
package public removes this step.

## First deployment

### 1. Create the data directory

```sh
mkdir -p /srv/linguacast/data
cd /srv/linguacast
```

Everything LinguaCast keeps lives here: the SQLite database and `admin.json`, the
file holding your admin account. The container takes ownership of this directory
itself, so it does not matter which user creates it.

### 2. Write the Compose file

Save this as `compose.yaml` beside `data/`.

```yaml
services:
  linguacast:
    # Pinned so an upgrade is a deliberate edit. Use :latest instead if you would
    # rather every `docker compose pull` take the newest release.
    image: ghcr.io/simon-vajda/linguacast:0.2.0
    restart: unless-stopped

    environment:
      # The public address guests reach this server at, as it appears from the
      # internet — an IP or a hostname. It goes straight into the ICE candidates, so
      # a wrong value produces a deployment where everything loads and no audio ever
      # arrives, with no error anywhere. Required: the `:?` form fails
      # `docker compose up` by name rather than starting a container that cannot work.
      MEDIA_ANNOUNCED_IP: ${MEDIA_ANNOUNCED_IP:?set this to the address guests reach this server at}

      # The address your reverse proxy reaches the container from. See the proxy
      # section below — it is usually not the address you expect.
      TRUSTED_PROXY_IPS: ''

      # One mediasoup worker per value, capped by the host's core count. Raising it
      # means publishing the matching extra RTC ports below, by hand.
      MEDIA_MAX_WORKERS: 4

      # The uid/gid the server runs as, and the owner the container gives ./data.
      # Set these to your own if you want to read the database from the host.
      PUID: 1000
      PGID: 1000

    ports:
      # HTTP: the SPA, the API and the Socket.IO endpoint. Only the reverse proxy
      # should reach this; it is plain HTTP.
      - '3000:3000'

      # RTC: worker i binds MEDIA_RTC_PORT_BASE + i on UDP and TCP alike. The external
      # and internal numbers must match — a remapped port leaves signalling working
      # and audio silently absent, because the port inside the ICE candidate is the
      # one the worker bound. Forward these on your router too.
      - '44400-44403:44400-44403/udp'
      - '44400-44403:44400-44403/tcp'

    volumes:
      # The SQLite database and admin.json. This is the whole of your data — back it
      # up, and it is what makes a container recreate survivable.
      - ./data:/data
```

Put your public address in a `.env` file beside it:

```sh
echo 'MEDIA_ANNOUNCED_IP=203.0.113.10' > .env
```

A hostname works too, as long as it resolves publicly to this server.

### 3. Start it

```sh
docker compose up -d
docker compose logs -f
```

You should see the schema migrate, the admin-account line, and a media line naming
the announced address and the ports:

```
No admin account at /data/admin.json — the setup wizard is open to whoever reaches it first
mediasoup: 4 worker(s) of 8 detected core(s) · ports 44400, 44401, 44402, 44403 (UDP and TCP) · announced 203.0.113.10 · TURN not configured
LinguaCast API listening on http://0.0.0.0:3000
```

Read the announced address in that line and check it against what the internet sees.
A warning underneath it means the value is private or loopback and no guest off this
machine will hear anything.

### 4. Forward the router ports

Forward **44400–44403 UDP and 44400–44403 TCP** to the host running the container.
Do not translate the port numbers: the port a guest connects to must equal the port
the worker bound, because that is the number inside the ICE candidate.

Port 3000 does **not** go on the router. Your reverse proxy reaches it locally.

### 5. Put the reverse proxy in front

Pick your proxy below, then come back and open your HTTPS URL. The setup wizard
claims the admin account for whoever reaches it first, so do this promptly.

## Reverse proxy

All three configurations do the same three things: terminate TLS, pass WebSocket
upgrades through for `/api/socket.io`, and append the visitor's address so the
sign-in throttle can tell callers apart.

Each is paired with the `TRUSTED_PROXY_IPS` value its placement needs.

### `TRUSTED_PROXY_IPS`, and why it is not the address you expect

LinguaCast believes an `X-Forwarded-For` header only when the connection itself
arrives from an address you listed. Unset, no forwarded address is ever trusted —
which is correct on its own, but behind a proxy it makes every visitor share one
sign-in throttle bucket, so one guesser can spend the budget you need to sign in.

The value is the address **the container sees the proxy connecting from**, which is
not the proxy's LAN address when the proxy talks to a published port. It is an exact
list, not a CIDR range, so give the proxy a stable address.

### nginx on the host

The proxy runs on the host and reaches the container through the published port, so
the container sees the connection arriving from the Compose network's gateway. Find
it:

```sh
docker network inspect linguacast_default -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
```

Set `TRUSTED_PROXY_IPS` to that address — typically something like `172.18.0.1`.

In the `http { }` block, once:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Then the site:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name linguacast.example.org;

    ssl_certificate     /etc/letsencrypt/live/linguacast.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/linguacast.example.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Socket.IO lives at /api/socket.io and needs the upgrade to pass through.
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;

        # A quiet channel between two speakers must not be closed as idle.
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name linguacast.example.org;
    return 301 https://$host$request_uri;
}
```

### Nginx Proxy Manager

NPM runs as a container, so put it on the same Docker network and let it reach
LinguaCast by service name — the container then sees NPM's own address on that
network rather than a gateway.

Add to your `compose.yaml`:

```yaml
services:
  linguacast:
    networks: [proxy]

networks:
  proxy:
    external: true
    name: <the network your NPM container is on>
```

Find the address NPM will arrive from:

```sh
docker inspect <npm-container> \
  -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'
```

Set `TRUSTED_PROXY_IPS` to that address. Container addresses can move when a
container is recreated, so pin NPM's address on that network if you want this to
survive unattended.

In the NPM UI, add a Proxy Host:

- **Details** — Domain Names: your hostname. Scheme: `http`. Forward Hostname/IP:
  `linguacast`. Forward Port: `3000`. Turn **Websockets Support** on; without it the
  studio and the listener page connect and then fall over.
- **SSL** — request a Let's Encrypt certificate, then enable **Force SSL** and
  **HTTP/2 Support**.

NPM appends `X-Forwarded-For` on its own; there is nothing to add in the Advanced tab.

### Caddy

Caddy obtains the certificate, upgrades WebSockets and appends `X-Forwarded-For` with
no configuration, so the whole site is:

```caddy
linguacast.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

Set `TRUSTED_PROXY_IPS` the same way as nginx above when Caddy runs on the host, or
the same way as NPM when Caddy runs as a container on a shared network.

## Check that audio actually works

Loading the page proves nothing about audio. The two failures this deployment is
prone to — a wrong announced address and an unforwarded port — both leave every
screen looking healthy.

1. Sign in at `/admin`, create an event and one channel, and enable both.
2. Open the speaker studio with the channel's speaker code and go live.
3. Open the listener page **from a device on a different network** — a phone on
   mobile data, with Wi-Fi off. Not the venue Wi-Fi, and not the same LAN as the
   server.
4. Join the channel and confirm you hear the studio.

Step 3 is the whole test. A listener on the same LAN can succeed while every real
guest fails, and can also fail while every real guest succeeds — see the hairpinning
note below.

## Upgrading

```sh
docker compose pull
docker compose up -d
```

Schema migrations run at boot, before the server accepts a request, so there is no
migration step to run. Your `data/` directory is untouched: the admin account, the
events and the channels survive.

If you pinned a version in `compose.yaml`, edit the tag first — `docker compose pull`
only fetches what the file names.

## Backups

Back up the `data/` directory. That is all of it: `linguacast.db` holds the events
and channels, `admin.json` holds your account.

Stop the container first. SQLite runs in WAL mode, so copying the files from under a
running server can capture a database whose write-ahead log is mid-transaction:

```sh
docker compose stop
tar czf linguacast-backup-$(date +%F).tar.gz data/
docker compose start
```

Restoring is the reverse — stop, replace `data/`, start.

## Troubleshooting

### Everything loads, and nobody hears anything

This is the deployment's signature failure, and almost always `MEDIA_ANNOUNCED_IP`.
The value goes verbatim into the ICE candidates handed to every guest, so a wrong one
produces well-formed candidates pointing at an address nobody can reach. Nothing
errors — the studio goes live, listeners join, and there is silence.

Check, in this order:

1. `docker compose logs | grep announced` and compare that address with what
   `curl -s https://api.ipify.org` reports from the host. They must match.
2. Confirm your router forwards 44400–44403 on **both** UDP and TCP to this host.
3. Confirm you did not remap the ports in `compose.yaml`. External and internal
   numbers must be identical.
4. Re-run the check above from mobile data, not from the LAN.

If audio works for some listeners and not others, the cause is on their side rather
than yours — `docs/solutions/operations/diagnosing-live-audio-from-a-user-report.md`
walks the symptom ladder for that.

### The studio cannot open the microphone, or signing in does nothing

You are reaching the server over plain HTTP. Browsers refuse `getUserMedia` off a
secure origin, and the session cookie is dropped without TLS, which makes a correct
password look like it silently failed. Go through the reverse proxy's HTTPS URL, not
`http://<host>:3000`.

### The container exits immediately

Read the last line of `docker compose logs`.

- `/data is not writable by 1000:1000` — the bind mount is read-only, or you set
  Docker's own `user:` directive to a uid that does not own it. Drop the `:ro`, or set
  `PUID`/`PGID` to the owner.
- `MEDIA_ANNOUNCED_IP … Required in production` — you started the container outside
  Compose, without the variable. The Compose file's `:?` form catches this earlier.

### Sign-in refuses a correct password after a few tries

Sign-in is throttled per address, and behind a proxy with `TRUSTED_PROXY_IPS` unset,
every visitor counts as the same address — so anyone hitting the login page spends
your budget. Set it to the address the proxy reaches the container from, as described
above.

### Listeners on the same LAN as the server hear nothing

Your router does not do NAT hairpinning: it will not send traffic aimed at your own
public address back inside. Guests off the network are unaffected. Split-horizon DNS
on your LAN is the usual fix, and it is a router problem rather than a LinguaCast one.

## Networks this deployment cannot serve

Guests connect straight to the RTC ports on UDP, falling back to TCP. Setting a STUN
server helps a guest behind a restrictive NAT discover its own address:

```yaml
MEDIA_STUN_URL: stun:stun.l.google.com:19302
```

That is an optional improvement, not a step — the deployment works without it.

What it cannot fix is a network that blocks **both** UDP and TCP to ports
44400–44403, which some corporate and hotel networks do. Those guests need a TURN
relay to carry the audio for them. The server supports one, but standing up a relay
is its own deployment — a port range, a shared secret, a relay policy — and this
guide does not cover it. The same limitation is what the hairpinning note above
describes for listeners inside your own LAN.

## Every setting

Everything below has a working default except `MEDIA_ANNOUNCED_IP`.

| Variable | Default | What it does |
|---|---|---|
| `MEDIA_ANNOUNCED_IP` | none — required | The public address that goes into ICE candidates. |
| `TRUSTED_PROXY_IPS` | unset | Comma-separated addresses whose `X-Forwarded-For` is believed. |
| `MEDIA_MAX_WORKERS` | `4` | Media workers, capped by core count. Each binds one RTC port. |
| `MEDIA_RTC_PORT_BASE` | `44400` | First RTC port. Change it and change the publications and the router. |
| `MEDIA_STUN_URL` | unset | Optional STUN server for guests behind restrictive NAT. |
| `MEDIA_TURN_URL` / `MEDIA_TURN_SECRET` | unset | A TURN relay and its shared secret. Both are needed for either to apply. |
| `PUID` / `PGID` | `1000` | The uid/gid the server runs as and the owner given to `/data`. |
| `PORT` | `3000` | The HTTP port inside the container. |
| `DATABASE_PATH` | `/data/linguacast.db` | Where the database lives. `admin.json` follows it. |
| `MEDIA_ROOM_IDLE_GRACE_MS` | `60000` | How long an empty event's router is kept before teardown. |
