#!/usr/bin/env node
// Drizzle's migrator reads .sql files from disk at runtime; tsdown bundles JavaScript
// only. migrate.ts resolves import.meta.dirname/migrations, which is dist/ inside the
// bundle, so the folder has to be placed there.
//
// Unlike scripts/copy-web-dist.mjs at the repo root, this lives inside apps/server on
// purpose: migrations are internal to this package and it reaches into no sibling, so
// `pnpm -F @hallspeak/server build` stays a standalone command.
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../src/db/migrations', import.meta.url));
const target = fileURLToPath(new URL('../dist/migrations', import.meta.url));

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`copied ${source} → ${target}`);
