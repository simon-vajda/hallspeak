#!/usr/bin/env node
// The image's runtime node_modules cannot come from the build stage. mediasoup's
// postinstall downloads a worker binary for whichever platform the install runs on,
// and the application build deliberately runs on the *build* platform, so a tree
// installed there carries the wrong worker for a cross-built image.
//
// This emits a standalone manifest holding only the packages
// apps/server/tsdown.config.ts leaves external — everything else is inside the
// bundle — so the target-platform stage can install them and get the right worker.
// The pino packages are external for their own reason: a transport target is resolved
// by module path inside a worker thread, so they must exist on disk in the image.
// It also carries "type": "module", because the emitted file is what lands beside
// dist/index.js in the image and an ESM bundle needs that field to load.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_DEPENDENCIES = [
  'mediasoup',
  'better-sqlite3',
  'pino',
  'pino-pretty',
  'pino-roll',
  'thread-stream',
];

const outDir = process.argv[2];

if (!outDir) {
  console.error('usage: emit-runtime-manifest.mjs <out-dir>');
  process.exit(1);
}

const serverManifestPath = fileURLToPath(new URL('../apps/server/package.json', import.meta.url));
const serverManifest = JSON.parse(await readFile(serverManifestPath, 'utf8'));
const declared = serverManifest.dependencies ?? {};

const dependencies = {};

for (const name of RUNTIME_DEPENDENCIES) {
  const version = declared[name];
  // Loud rather than silent: a rename would otherwise ship an image with no worker,
  // which fails at the first Go live rather than at build time.
  if (!version) {
    console.error(`${name} is not a dependency of ${serverManifestPath}`);
    process.exit(1);
  }
  dependencies[name] = version;
}

const target = path.join(outDir, 'package.json');

await mkdir(outDir, { recursive: true });
await writeFile(
  target,
  `${JSON.stringify(
    {
      name: 'hallspeak-runtime',
      version: serverManifest.version,
      private: true,
      type: 'module',
      dependencies,
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${target}`);
