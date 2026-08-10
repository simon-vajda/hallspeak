#!/usr/bin/env node
// The single cross-package edge in the build (ADR §4): apps/web's build output is
// copied into apps/server's deploy artifact.
//
// This lives at the repo root, not inside either package, on purpose. In
// apps/server/build it would make that package's build reach into a sibling's
// dist; in apps/web/build it would make web write outside its own directory.
// Either would break `pnpm -F <pkg> build` as a standalone command.
//
// The Dockerfile never places the SPA itself — that knowledge lives here alone,
// which is what makes `pnpm build && node apps/server/dist/index.js` on a laptop
// run the identical layout to the image.
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../apps/web/dist', import.meta.url));
const target = fileURLToPath(new URL('../apps/server/dist/public', import.meta.url));

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`copied ${source} → ${target}`);
