---
title: Pin mediasoup's prebuilt worker to a kernel line the base image can load
date: 2026-08-23
category: integration-issues
module: Dockerfile
problem_type: integration_issue
component: infrastructure
symptoms:
  - "Docker build dies with `/bin/sh: 1: python: not found` inside mediasoup's postinstall, with no python dependency anywhere in the app"
  - "The real error is one layer down: the fetched worker fails to load with `GLIBC_2.38 not found` and `GLIBCXX_3.4.31 not found`"
  - "The failure reproduces only on one build host; another machine pulls a different, working asset for the same mediasoup version"
  - "mediasoup's postinstall silently falls back to compiling from source instead of failing when the downloaded prebuilt binary cannot run"
root_cause: config_error
resolution_type: config_change
severity: high
framework_version: mediasoup 3.24.2
related_components:
  - apps/server
tags:
  - docker
  - mediasoup
  - multi-arch
  - glibc
  - prebuilt-binaries
  - reproducible-builds
  - native-addons
---

# Pin mediasoup's prebuilt worker to a kernel line the base image can load

## Problem

Building a multi-arch (`linux/amd64` + `linux/arm64`) image for an app depending on
`mediasoup@3.24.2` failed inside mediasoup's postinstall with a Python-not-found error,
on a base image (`node:24-bookworm-slim`) that has no relation to Python and no missing
toolchain the app actually needs.

## Symptoms

Building on an OrbStack Docker VM (host kernel `7.0.14-orbstack-...`):

```
/bin/sh: 1: python: not found
```

Running the worker binary the postinstall had already fetched surfaced the real error one
layer down:

```
/lib/aarch64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found
/lib/aarch64-linux-gnu/libstdc++.so.6: version `GLIBCXX_3.4.31' not found
```

`node:24-bookworm-slim` ships glibc 2.36; the asset mediasoup picked needed 2.38.

## What Didn't Work

The visible error names Python, so every obvious reading is downstream of the actual cause:

- **Install python3 in the build stage.** This "fixes" the symptom by letting mediasoup fall
  through to compiling the worker from source — which also needs a C++ toolchain, balloons the
  image, and produces a binary chosen by whatever the build machine happens to have. It never
  explains why a *prebuilt* binary was rejected in the first place.
- **Install a full build-essential toolchain.** Same problem, heavier. It treats "mediasoup
  needs to compile" as the given, when the given is "mediasoup downloaded a binary
  incompatible with this base image's glibc, then silently fell back to compiling."
- **Switch to an Alpine base.** Worse, not better. mediasoup publishes no musl worker binary
  at all (`Dockerfile:3-4`), so Alpine guarantees a source build on every install, on every
  architecture, permanently.

## Solution

Repo-root `Dockerfile`, three pieces.

**1. Suppress the fetch in stages that never run a worker.** The application-build stage
produces a JS bundle only — `tsdown` leaves mediasoup external
(`apps/server/tsdown.config.ts:16-18`) — so it has no business fetching a worker for any
platform:

```dockerfile
ENV MEDIASOUP_WORKER_BIN=/nonexistent
```

(`Dockerfile:21-24`, repeated for the `deps` stage at `Dockerfile:55`.) mediasoup's postinstall
checks this variable and skips its download/build path whenever it is set.

**2. Fetch the correct asset explicitly, in the target-platform stage.** The `deps` stage runs
unpinned to `$TARGETPLATFORM` (`Dockerfile:47-51`) and chooses the asset itself:

```dockerfile
ARG MEDIASOUP_WORKER_KERNEL=6
...
case "${TARGETARCH}" in \
  amd64) arch=x64 ;; \
  arm64) arch=arm64 ;; \
  *) echo "no mediasoup worker is published for ${TARGETARCH}" >&2; exit 1 ;; \
esac; \
asset="mediasoup-worker-${version}-linux-${arch}-kernel${MEDIASOUP_WORKER_KERNEL}.tgz"; \
curl -fsSL -o /tmp/worker.tgz "${release}"; \
out=/runtime/node_modules/mediasoup/worker/out/Release; \
tar -xzf /tmp/worker.tgz -C "${out}"; \
```

(`Dockerfile:77-96`.) The `TARGETARCH`→arch mapping matters: Docker names architectures
`amd64`/`arm64`, mediasoup's release assets use Node's `os.arch()` naming (`x64`/`arm64`), so a
bare pass-through 404s against the release URL. The extraction target is mediasoup's own
default lookup path, so nothing needs to point at it at runtime.

**3. Assert the binary runs, in the build.**

```dockerfile
status=0; "${out}/mediasoup-worker" >/dev/null 2>&1 || status=$?; \
if [ "${status}" -ne 41 ]; then \
  echo "mediasoup-worker from ${asset} did not run in this image (exit ${status})" >&2; \
  exit 1; \
fi
```

(`Dockerfile:92-96`.) Exit 41 is mediasoup's own validity signal, from its `npm-scripts.mjs`: a
worker invoked with no arguments always fails on purpose, and 41 means it loaded and ran. A
dynamic-linker failure exits 1; a missing or non-executable file exits 126 or 127.

## Why This Works

mediasoup names its prebuilt asset
`mediasoup-worker-<version>-linux-<arch>-kernel<major>.tgz`, where `<major>` comes from
`os.release()` **on the machine running the install**, not from anything about the target
image. Each kernel-major line is built against that era's glibc. So an install-time reading of
the *build host's* kernel silently determines a *runtime* glibc requirement baked into the
shipped image: a CI runner on kernel 6 and a developer's VM on kernel 7 produce different
images from identical source, and neither gets a signal that anything is wrong. When the
binary will not load, the postinstall does not fail — it recompiles, which is where the
unrelated Python error comes from.

Pinning removes the derivation. `MEDIASOUP_WORKER_KERNEL` is a build arg, not a `uname` read,
so the same Dockerfile produces the same worker regardless of which machine builds it. Kernel 6
was verified rather than assumed: the kernel6 asset ran inside `node:24-bookworm-slim` (exit
41) and the kernel7 asset did not (the glibc errors above, exit 1). The kernel5 asset 404s for
this version, so kernel 6 is also the floor — which is why the published image requires a host
on Linux kernel 6 or newer.

## Prevention

Any dependency whose install step selects a platform-specific binary by inspecting the machine
performing the install, rather than the machine that will run it, is unsafe to leave on
autopilot in a cross-platform build. Pin the selection and verify the pinned choice against the
actual target. Autodetection optimizes for "works on the build machine," which is the wrong
machine.

This needs revisiting, not just re-verifying, when:

- **`NODE_IMAGE` moves to a newer Debian release.** A newer glibc could support `kernel7` and
  make the pin unnecessarily conservative — or the base could stay put while mediasoup's
  minimum kernel line rises, staling the pin the other way.
- **mediasoup is upgraded and drops the kernel6 line.** Nothing forces the version bump and
  `MEDIASOUP_WORKER_KERNEL` to move together.
- **A new target architecture is added.** The `case` mapping (`Dockerfile:79-83`) is exhaustive
  over today's two platforms and fails closed on anything else.

The exit-41 assertion is what makes all three loud instead of silent: it does not check that a
file downloaded, it checks that the binary the build just placed can load and execute in this
exact base image.

## Related Issues

- `docs/solutions/integration-issues/decline-the-inferred-native-build-for-better-sqlite3.md` —
  the same family: a native addon's install step makes a host-dependent inference that breaks
  in a minimal image. That one is about declining an inferred build for a package that ships
  portable binaries; this one is about a binary that is portable only within one glibc era.
- `AGENTS.md` carries the rule in its Dockerfile bullet and points here.
