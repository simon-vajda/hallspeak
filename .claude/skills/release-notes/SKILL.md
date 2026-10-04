---
name: release-notes
description: Polish a Hallspeak server or mobile release draft before publishing — add a plain-language summary above its PR list, group maintenance PRs separately, and write the result back to the draft after confirmation. Use when asked to write, polish, summarize or prepare release notes, or as the step before publishing a draft the release skill produced.
---

# Polish a release draft

A successful `main` build after a bump creates a draft GitHub Release whose body lists the
PRs that touched that track's paths since its newest published release, from
`scripts/release-notes.mjs`. That list is complete and already correct. This skill adds what
a script cannot: a summary for the track's users and contributors, and a split between
user-facing changes and maintenance. It edits one unpublished draft and nothing else.

`docs/versioning.md` is the release contract; the `release` skill bumps versions and opens
the PR that leads to the draft.

| Track | Draft tag prefix | Readers of the highlights |
| --- | --- | --- |
| server (includes the bundled web app) | `server-v` | people self-hosting Hallspeak |
| mobile | `mobile-v` | listeners using the app |

## Procedure

Run these in order. Stop and report at the first failure; do not work around one.

**1. Find the draft and its range.** Ask which track if the user did not say.

```bash
TRACK=mobile   # or: server
git fetch --tags origin
DRAFT=$(gh api repos/{owner}/{repo}/releases --paginate \
  --jq ".[] | select(.draft and (.tag_name | startswith(\"$TRACK-v\"))) | [.id, .tag_name, .target_commitish] | @tsv")
PREVIOUS=$(gh api repos/{owner}/{repo}/releases --paginate \
  --jq ".[] | select(.draft == false and .prerelease == false) | .tag_name | select(startswith(\"$TRACK-v\"))" \
  | sort -V | tail -n 1)
echo "$DRAFT"; echo "previous: ${PREVIOUS:-none}"
```

Run this block as one shell command: the variables do not survive into a separate call.

With no draft for the track, stop and say there is no draft to polish: either the newest
release is already published or the bump's build has not finished. Never fall back to a
published release. The draft workflow keeps at most one draft per track; if more than one
appears, stop and report them.

From the draft line take the release id, the tag and `target_commitish` (the commit the
draft was built from).

**2. List the PRs.**

```bash
node scripts/release-notes.mjs <track> --json --to <target_commitish> --tag <tag> \
  --from <previous>
```

Fill the placeholders from step 1's output. Pass `--from` whenever step 1 printed a
previous tag; leave it out only when it printed `previous: none`.

Use these entries, not the draft's markdown: they are the same list with commit SHAs and PR
numbers as data. Every entry must appear in the final body.

**3. Read each PR and classify it.**

```bash
gh pr view <number> --json title,body,files
```

Put each PR in exactly one group:

- **User-facing** — changes what an operator (server) or listener (mobile) gets: features,
  fixes, behaviour, defaults, performance, the hosting setup.
- **Maintenance** — dependency bumps that change nothing at runtime, tooling, tests, CI,
  documentation and agent instructions, refactors with no visible effect, and the
  `chore(release)` PR itself.

The conventional type is a hint, not a rule. A `build(deps)` that touches only dev
dependencies, a `test`, `ci` or `docs` PR, and `chore(release)` usually land in Maintenance;
a `build(deps)` that changes runtime behaviour, or a `refactor` that fixes a visible bug, is
user-facing. Decide from the body and the changed files. A shared-package PR that the track
does not actually use still stays in the list; leave it out of the summary instead.

**4. Server only: find what an operator must do.**

```bash
git diff <previous> <target_commitish> -- .env.example compose.yaml
git diff <previous> <target_commitish> -- apps/server/src/version.ts | grep MIN_MOBILE_VERSION \
  || echo "MIN_MOBILE_VERSION unchanged"
```

Ignore the `HALLSPEAK_VERSION=` line in `.env.example`: it changes on every server bump and
operators already follow it. Anything else is an upgrade step to name: a new, removed or
renamed environment variable, a changed default, a `compose.yaml` change (ports, volumes,
services, healthchecks), or a raised `MIN_MOBILE_VERSION`, which means listeners on older
app versions must update. Without a previous release there is nothing to diff; say this is
the first server release instead.

**5. Compose the body.**

```markdown
## Highlights

<plain-language prose or a few bullets about what this release changes for its readers>

## Technical notes

<short bullets for contributors: notable internals, dependency jumps, protocol changes>

### Upgrading                  <- server only

<each operator step from step 4, or "No action needed.">

## What's Changed

* <title> by <author> in <url>          <- user-facing PRs, script line format

### Maintenance

* <title> by <author> in <url>          <- maintenance PRs

**Full Changelog**: https://github.com/{owner}/{repo}/compare/<previous>...<tag>
```

Write the highlights for the track's readers in the table above: what they will notice, in
their words, with no internal names, PR numbers or marketing tone. Omit changes they would
not notice. If nothing in the release is user-facing, say so in one sentence. Keep the
technical notes short; they point at what matters, the list below carries the rest.

Keep each list line exactly as the script renders it, in the script's order within its
group. Omit an empty group's heading. Omit the compare link when there is no previous
release.

**6. Show and ask.** Show the full body and the draft it will replace (tag and id). Write
nothing until the user approves. If they ask for changes, revise and show it again. If they
decline, stop: the draft stays as it is.

**7. Write the draft.**

```bash
STATE=$(gh api repos/{owner}/{repo}/releases/<id> --jq .draft)
[ "$STATE" = true ] || { echo "release <id> is no longer a draft"; exit 1; }
gh api --method PATCH repos/{owner}/{repo}/releases/<id> -F body=@<body file>
```

Write the body to a file outside the repository first. A draft has no tag to address, so the
release is written by id. If the release is no longer a draft, or no longer exists, stop and
report: it was published or superseded since step 1.

**8. Report.** Say the draft is updated and that publishing it under Releases is the
maintainer's step. A later bump of the same track replaces this draft with a fresh,
unpolished one; run this skill again then.

## Guard rails

- Never publish a release, create or push a tag, or edit a published release. Only the
  draft found in step 1 is written, and only after the user approves.
- Never change the title, tag, target, assets or Latest setting of the draft; only its body.
- Never drop a PR from the list or reword a list line. Relevance decides the summary, not the
  list.
