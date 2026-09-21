---
name: release
description: Cut a Hallspeak server or mobile release — show what changed per track, bump the canonical version on a release branch, verify, commit and open the release PR. Use when asked to release, cut a version, ship a version, tag a release, or bump the server or mobile version.
---

# Release a Hallspeak version

Hallspeak has two independent release tracks. `docs/versioning.md` is the contract behind
this procedure — read it if a compatibility question comes up mid-release; do not restate
it here.

A release reaches GitHub in three stages, and this skill owns only the first:

1. **This skill** bumps the version on a release branch and opens a pull request.
2. **Merging the PR** builds that commit's image on `main`, and the successful build
   creates a draft GitHub Release with generated notes (and, for server, `compose.yaml` and
   `env.example` attached).
3. **The maintainer publishes the draft** under Releases after editing its description.
   Publishing creates the tag and, for server, promotes the image `main` already built to
   `X.Y.Z`, `X.Y` and `latest`.

| Track | Canonical manifest | Command | Tag | Paths that count |
| --- | --- | --- | --- | --- |
| server (includes the bundled web app) | `apps/server/package.json` | `pnpm version:server` | `server-vX.Y.Z` | `apps/server` `apps/web` `packages` `compose.yaml` `.env.example` `Dockerfile` |
| mobile | `apps/mobile/package.json` | `pnpm version:mobile` | `mobile-vX.Y.Z` | `apps/mobile` `packages` |

Choosing the number: patch for a compatible fix, minor for a backward-compatible feature,
major for a break. Any web change is a **server** bump. A shared-package change bumps each
track whose shipped behaviour changes. Strict `X.Y.Z`, no prerelease.

## Procedure

Run these in order. Stop and report at the first failure; do not work around one.

**1. Present what changed, then ask.**

```bash
git fetch --tags origin
gh api repos/{owner}/{repo}/releases --paginate \
  --jq '.[] | select(.draft == false and .prerelease == false) | .tag_name | select(startswith("server-v"))' \
  | sort -V | tail -n 1                       # newest published tag; repeat with mobile-v
git log --format='%h %s' server-v0.10.0..origin/main -- apps/server apps/web packages compose.yaml .env.example Dockerfile
git log --format='%h %s' mobile-v0.3.0..origin/main -- apps/mobile packages
```

Take the newest tag from published releases, not from `git tag`: the highest tag is not
always the newest release. For each track, show that tag, the current manifest version on
`origin/main`, and the commit subjects since, grouped by conventional type (`feat`, `fix`,
then the rest). A track whose manifest already differs from its newest published tag has a
bump waiting for its draft to be published; say so.

Ask which track and which version. Never guess a version number, even when the commits make
one look obvious.

**2. Prepare the release branch.**

```bash
git status --short
git switch main && git merge --ff-only origin/main
git switch -c release/server-v0.11.0         # or: release/mobile-v0.5.0
```

A dirty tree stops the release: name the files and ask. Do not stash, reset or discard. A
`main` that cannot fast-forward — local commits `origin/main` lacks — also stops it: report
the diverged commits and leave `main` as it is.

**3. Bump and verify.**

```bash
pnpm version:server 0.11.0    # or: pnpm version:mobile 0.5.0
pnpm check && pnpm typecheck && pnpm test
git status --short            # a change after typecheck beyond the bump is generated-file drift
git diff
```

The bump command writes files only and restores every file it touched if its own check
fails. For server it updates the manifest, the `HALLSPEAK_VERSION` pin in `.env.example`,
and the generated OpenAPI artifacts. For mobile it updates the manifest alone;
`app.config.ts` derives Expo's store-facing version from it.

Show the user the diff and the tag the release will get, then commit only the bumped files:

```bash
git add apps/server/package.json .env.example packages/contract/openapi.json packages/contract/src/generated/api.d.ts
git commit -m "chore(release): server v0.11.0"
```

For mobile the file list is `apps/mobile/package.json` and the message
`chore(release): mobile v0.5.0`.

**4. Ask, then open the PR.**

Confirm with the user before anything leaves the machine. If they decline, stop: the branch
and commit stay local, and `git push -u origin <branch>` followed by `gh pr create` opens it
later.

```bash
git push -u origin release/server-v0.11.0
gh pr create --base main --title "chore(release): server v0.11.0" --body "..."
```

The body says what merging does (the `Server release` build runs, then a
`server-v0.11.0` draft appears under Releases, replacing any older unpublished server
draft) and what publishing does (creates the tag and promotes the image; for mobile, notes
only).

**5. Stop and report.**

Give the PR URL. Tell the user that once `Verify` and `Docker image` pass and the PR is
merged, they edit the draft's description under Releases and publish it, and that a server
publish waits for the commit's image build before promoting it. Do not merge, watch, or
publish.

## Guard rails

- Never push to `main`, never create or push a tag, never publish, edit or delete a
  release. Publishing is the maintainer's step on GitHub.
- Never `git push --force`, never `--no-verify`.
- Never edit a version by hand. `apps/server/src/version.ts`, `apps/web/src/version.ts`,
  `apps/mobile/src/version.ts`, `app.config.ts`, `.env.example` and the OpenAPI `info.version`
  all derive from a canonical manifest, and `pnpm version:check` fails if one drifts.
- `pnpm version:check` also asserts that `MIN_SERVER_VERSION` (client-core) and
  `MIN_MOBILE_VERSION` (server) have not passed their own track's version. If it fails, the
  fix is a decision about compatibility, not a number to nudge — take it to the user.
- Raising `MIN_MOBILE_VERSION` locks out installed apps. It needs a planned compatibility
  removal or a documented security emergency, and the user's explicit agreement.
- Both tracks may be bumped in one PR; each gets its own draft and neither replaces the
  other.
