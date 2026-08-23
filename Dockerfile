# syntax=docker/dockerfile:1

# Debian slim, not Alpine: mediasoup publishes no musl worker binary, so an Alpine
# base silently degrades to a source build needing python3 and a C++ toolchain.
ARG NODE_IMAGE=node:24-bookworm-slim

# mediasoup names its prebuilt worker after the *installing host's* kernel major, and
# each of those builds targets that kernel's era of glibc — the kernel7 asset needs
# glibc 2.38, which bookworm (2.36) does not have. Deriving it would make the image's
# worker depend on which machine built it, so it is pinned to the newest asset the
# base image can actually load and verified below rather than assumed.
ARG MEDIASOUP_WORKER_KERNEL=6

# The application build is architecture-independent — a JavaScript bundle and the
# built SPA — so it is pinned to the build platform. Only the native-dependency
# stage below runs as the target platform, which keeps emulated pnpm installs and
# Vite builds off the arm64 path entirely.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS builder

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Nothing in this stage runs a worker: tsdown leaves mediasoup external. Setting the
# variable is how its postinstall is told to skip the download it would otherwise do
# for the wrong platform.
ENV MEDIASOUP_WORKER_BIN=/nonexistent
WORKDIR /build

RUN corepack enable

# Manifests and the lockfile first, so a source-only change does not re-resolve.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contract/package.json packages/contract/package.json
# The tool's own bin script travels with its manifest: pnpm links workspace bins at
# install time and silently skips one whose target file is not there yet.
COPY tools/openapi-codegen/package.json tools/openapi-codegen/bin.mjs tools/openapi-codegen/
RUN pnpm install --frozen-lockfile

COPY . .

# Chains contract generation, the Vite build, tsdown, the migration copy and the SPA
# copy. The SPA's placement lives in scripts/copy-web-dist.mjs alone — this image
# must never duplicate that knowledge, or a laptop run and a container run diverge.
RUN pnpm build
RUN node scripts/emit-runtime-manifest.mjs /runtime

# No platform pin, so this builds as $TARGETPLATFORM and carries the natives for the
# image they ship in. npm rather than pnpm: the emitted manifest is a generated
# two-package tree, and npm's flat node_modules copies across a stage boundary with
# no symlinked store to preserve.
FROM ${NODE_IMAGE} AS deps

ARG TARGETARCH
ARG MEDIASOUP_WORKER_KERNEL
ENV MEDIASOUP_WORKER_BIN=/nonexistent
WORKDIR /runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /runtime/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Fetching the worker here rather than letting the postinstall do it is what makes the
# image reproducible: the asset is chosen by the target architecture and the pinned
# kernel line, not by the builder. Exit status 41 is mediasoup's own signal that a
# prebuilt binary loaded and ran — anything else means the wrong arch or glibc, and
# the build must fail here rather than at the operator's first Go live.
RUN set -eu; \
  version="$(node -p "require('/runtime/node_modules/mediasoup/package.json').version")"; \
  case "${TARGETARCH}" in \
    amd64) arch=x64 ;; \
    arm64) arch=arm64 ;; \
    *) echo "no mediasoup worker is published for ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  asset="mediasoup-worker-${version}-linux-${arch}-kernel${MEDIASOUP_WORKER_KERNEL}.tgz"; \
  release="https://github.com/versatica/mediasoup/releases/download/${version}/${asset}"; \
  echo "fetching ${release}"; \
  curl -fsSL -o /tmp/worker.tgz "${release}"; \
  out=/runtime/node_modules/mediasoup/worker/out/Release; \
  mkdir -p "${out}"; \
  tar -xzf /tmp/worker.tgz -C "${out}"; \
  rm /tmp/worker.tgz; \
  status=0; "${out}/mediasoup-worker" >/dev/null 2>&1 || status=$?; \
  if [ "${status}" -ne 41 ]; then \
    echo "mediasoup-worker from ${asset} did not run in this image (exit ${status})" >&2; \
    exit 1; \
  fi

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app

COPY --from=deps /runtime/package.json ./package.json
COPY --from=deps /runtime/node_modules ./node_modules
COPY --from=builder /build/apps/server/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# DATABASE_PATH resolves against the working directory, so leaving it unset would place
# the database inside the image at /app/data. admin.json follows it, so this one
# variable puts both on the mount.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MEDIA_RTC_PORT_BASE=44400 \
    MEDIA_MAX_WORKERS=4 \
    DATABASE_PATH=/data/linguacast.db

# Worker i binds MEDIA_RTC_PORT_BASE + i on UDP and TCP alike. These are the four
# ports the default MEDIA_MAX_WORKERS uses; raising it means publishing more.
EXPOSE 3000
EXPOSE 44400-44403/udp
EXPOSE 44400-44403/tcp

# GET /api/version needs no session and touches no database. Driven by Node's own
# fetch because the slim base carries neither curl nor wget, and installing one to
# poll a local port is a package for nothing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/version`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]
