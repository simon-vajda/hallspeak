# Versioning and compatibility

LinguaCast ships two release artifacts on independent schedules. This file is the contract
between them: what each version number means, which client may talk to which server, and
where the constants that decide it live. The step-by-step release procedure is not here —
it is the `release` skill under `.claude/skills/release`.

## Two tracks, and why

- `apps/server/package.json` is the canonical version of the server **and the bundled web
  app**, which ships inside the server image and therefore cannot have a version of its own.
- `apps/mobile/package.json` is the canonical version of the mobile app, and the source
  Expo's store-facing `version` is derived from in `app.config.ts`.
- Every other manifest — root, web, contract, client-core, tooling — stays private at
  `0.0.0`. They are workspace source, not releases.

The tracks are separate because their distribution is. A server upgrade is `docker compose
pull` and takes effect when the operator chooses. A mobile upgrade goes through store review
and staged rollout, and leaves real guests on older builds for months. Any scheme that
required matching numbers would either hold the server back or tell guests their app is
broken when it is not.

Coordinate dates and commits when it helps. Never require matching version numbers.

## What a bump means

| Track | Patch | Minor | Major |
| --- | --- | --- | --- |
| Server | compatible bug, security, performance, dependency or deployment fix | backward-compatible server, admin, web, REST or Socket.IO feature | supported-client break, endpoint or event removal, incompatible deployment change, planned mobile-floor raise |
| Mobile | compatible fix in the app | app feature | app-side break; implies nothing about the server |

- Any web change bumps the **server**, because the web ships inside the server image.
- A shared-package change bumps each deployable whose shipped behaviour changes. Both tags
  may land on the same commit.
- Documentation-only commits bump nothing.
- Moving a canonical version in a manifest is not itself a release. Publishing its draft
  is.

## Compatibility

### Current matrix

Mobile `0.1.0` accepts server `>= 0.4.0` and `< 1.0.0`. Server `0.4.0` accepts mobile
`>= 0.1.0` with no upper bound.

The server has no maximum accepted mobile version, by design: it cannot know what a future
app needs, and the app is the half that can decide. A newer server than the app supports is
therefore refused **by the app**, and the guest is told to update the app — the only half
they can act on.

### Where the constants live

| Constant | File | Meaning |
| --- | --- | --- |
| `MIN_SERVER_VERSION` | `packages/client-core/src/server/compatibility.ts` | Oldest server this mobile release will talk to |
| `SUPPORTED_SERVER_MAJORS` | same file | Server majors this mobile release accepts |
| `SERVER_CAPABILITIES` | same file | Per-feature server thresholds, for selection only |
| `MIN_MOBILE_VERSION` | `apps/server/src/version.ts` | Oldest mobile app this server accepts |

`MIN_SERVER_VERSION` and `SERVER_CAPABILITIES` hold the same value today and are deliberately
separate constants. The floor is policy; a capability is a feature test. Folding them
together means the first capability introduced at a later version silently raises the floor
and locks out servers that are otherwise fine.

`pnpm version:check` asserts that neither floor has passed its own track's version, because
nothing else in the repository would notice.

### Client gates

- **Web** must equal the server version exactly. It ships in the same image, so anything else
  is a stale tab, and the answer is always a reload.
- **Mobile** reads `GET /api/version` once per host before any event request or socket, and
  `assessServerCompatibility` returns one of `supported`, `mobile-too-old`, `server-too-old`,
  `server-too-new`, `invalid-version`. Precedence is fixed and tested: malformed input, then
  the server's own mobile floor, then the major window, then `MIN_SERVER_VERSION`.
- The handshake's `clientType` is **defaulted** to `web`, not required, and a handshake that
  declares none is answered with the legacy `client_too_old` code. A tab holding a bundle from
  before that field existed carries its own copy of the client's error-message map, which knows
  only the old code; the default alone gets it past schema parsing and still leaves it printing
  a generic connection failure at the one moment it needs to be told to reload. Both the default
  and the legacy code are removable once no bundle predating server `0.4.0` can still be open.

### Keeping changes additive

Within a server major:

- Add endpoints and events; never replace them.
- Add optional fields only.
- Never repurpose an existing field, event or error code.

Roll out a breaking seam in three steps: a compatible server minor adds both variants, a
mobile release selects between them by capability, and a later server major removes the old
one. Do not add a global REST version prefix or a versioned Socket.IO namespace until a
wholesale protocol replacement makes parallel APIs unavoidable.

Public mobile `1.x` supports server `1.x`. When server `2` arrives, mobile supports majors
`1` and `2`. A mobile release supports the current and previous server major.

Raise `MIN_MOBILE_VERSION` only for a planned compatibility removal or a documented security
emergency.

## Tags, images and releases

- Stable tags are `server-vX.Y.Z` and `mobile-vX.Y.Z`, strict `X.Y.Z`, no prerelease. Nobody
  pushes one: publishing a release creates it, and the ruleset forbids moving or deleting it.
- A version reaches `main` only through a bump pull request. Every push to `main` builds and
  verifies the server image once and publishes it as `edge` and `sha-<7 chars>`.
- When that build succeeds, each track whose manifest version has no release yet gets a draft
  release targeting the built commit, titled `Server vX.Y.Z` or `Mobile vX.Y.Z`, with notes
  generated since the track's newest published release. A newer bump deletes an older
  unpublished draft of the same track; a push that leaves the version alone leaves the draft,
  and any edits to it, untouched. Server drafts carry that commit's `compose.yaml` and
  `.env.example`, the latter as `env.example` because GitHub renames assets starting with a
  period.
- Publishing a server draft waits for its commit's build, checks the tag against the manifest,
  and retags that commit's `sha-*` image as `X.Y.Z`, `X.Y` and `latest`. Nothing is rebuilt or
  retested, so the release is the digest `main` verified. A failed or missing build refuses the
  promotion, and rerunning the job retries it.
- Publishing a mobile draft produces the release only. It never takes the repository-wide Latest
  designation from the server track, and publishes no binary; EAS and store credentials are
  separate work.
- A weekly cleanup keeps the newest 20 `sha-*` images plus every released version, `latest`,
  `edge` and each unpublished draft's image.

## Known limits

- **`edge` images misreport their version.** An `edge` build carries the last released
  manifest version while running unreleased code, so a mobile capability check against it can
  say `supported` for a protocol that has since moved. Accepted: `edge` is a channel for people
  who chose it, and the alternative — prerelease identifiers — would put a `-dev` suffix
  through gates that are numeric by design. Do not point a store build at an `edge` server.
- **`.env.example` runs ahead of the registry.** The pin moves when the version does, so
  on `main`, between the bump merging and its draft being published, it names an image tag that
  does not exist yet. Operators take `.env.example` from a published release, never from
  `main`. Publish the draft promptly after the bump merges.
- **The mobile floor is one number, not a range.** A mobile release cannot refuse a specific
  broken server patch, only everything below a version. If that is ever needed, it is a
  capability, not a floor.

## Assumptions

- Server `0.4.0` is the initial canonical server version; adopting it forced no release.
- Server `1.0` is published and tested before the first public mobile store release. Internal
  mobile builds may target server `0.x`.
- Shared workspace packages stay internal source and never receive release versions.
