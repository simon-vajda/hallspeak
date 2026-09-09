---
name: release
description: Cut a LinguaCast server or mobile release — bump the canonical version, verify, commit, tag and push, then confirm the workflow. Use when asked to release, cut a version, ship a version, tag a release, or bump the server or mobile version.
---

# Release a LinguaCast version

LinguaCast has two independent release tracks. `docs/versioning.md` is the contract behind
this procedure — read it if a compatibility question comes up mid-release; do not restate
it here.

Ask which track and which version if the user did not say. Never guess a version number.

| Track | Canonical manifest | Command | Tag |
| --- | --- | --- | --- |
| server (includes the bundled web app) | `apps/server/package.json` | `pnpm version:server` | `server-vX.Y.Z` |
| mobile | `apps/mobile/package.json` | `pnpm version:mobile` | `mobile-vX.Y.Z` |

Choosing the number: patch for a compatible fix, minor for a backward-compatible feature,
major for a break. Any web change is a **server** bump. Strict `X.Y.Z`, no prerelease.

## Procedure

Run these in order. Stop and report at the first failure; do not work around one.

**1. Start from the release commit on `main`.**

```bash
git switch main && git pull
git status --short
```

A dirty tree stops the release. Do not stash or discard the user's work — say what is there
and ask.

**2. Bump.**

```bash
pnpm version:server 0.5.0    # or: pnpm version:mobile 0.2.0
```

Omit the version for an interactive prompt with a preview. The command writes files only —
no commit, no tag, no push — and restores every file it touched if verification fails. For
server it updates the manifest, the `LINGUACAST_VERSION` pin in `.env.example`, and the
generated OpenAPI artifacts. For mobile it updates the manifest alone; `app.config.ts`
derives Expo's store-facing version from it.

**3. Verify.**

```bash
pnpm check && pnpm typecheck && pnpm test
git status --short   # a dirty tree after typecheck is generated-file drift
git diff
```

Show the user the diff and the expected tag before going further.

**4. Commit and push.**

```bash
git add -A
git commit -m "chore(release): server v0.5.0"
git push origin main
```

**5. Tag — confirm with the user first.**

A pushed tag publishes an image and creates a public GitHub Release. It is the point of no
return in this procedure. Confirm the version, then:

```bash
git tag server-v0.5.0
git push origin server-v0.5.0
```

Tag the exact commit whose manifest matches; the workflow refuses any other.

**6. Watch the workflow.**

```bash
gh run watch "$(gh run list --workflow 'Server release' --limit 1 --json databaseId --jq '.[0].databaseId')"
```

`server-v*` runs verification, publishes GHCR `X.Y.Z`, `X.Y` and `latest`, then creates
`LinguaCast Server X.Y.Z`. `mobile-v*` type-checks and tests the app, then creates
`LinguaCast Mobile X.Y.Z` without moving the repository-wide Latest designation; it publishes
no store binary.

Report the release URL when it lands.

## Guard rails

- Never `git push --force`, never retag a published version, never `--no-verify`.
- Never edit a version by hand. `apps/server/src/version.ts`, `apps/web/src/version.ts`,
  `apps/mobile/src/version.ts`, `app.config.ts`, `.env.example` and the OpenAPI `info.version`
  all derive from a canonical manifest, and `pnpm version:check` fails if one drifts.
- `pnpm version:check` also asserts that `MIN_SERVER_VERSION` (client-core) and
  `MIN_MOBILE_VERSION` (server) have not passed their own track's version. If it fails, the
  fix is a decision about compatibility, not a number to nudge — take it to the user.
- Raising `MIN_MOBILE_VERSION` locks out installed apps. It needs a planned compatibility
  removal or a documented security emergency, and the user's explicit agreement.
- Both tags may point at the same commit and ship the same day.
