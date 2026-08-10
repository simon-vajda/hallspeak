#!/usr/bin/env node
// Runs openapi-typescript's own CLI, in-process, from this package's TypeScript 5
// resolution scope. The CLI reads process.argv itself, so arguments and exit codes
// pass through untouched.
//
// Why TypeScript 5 is confined here: openapi-typescript emits its output with the
// `ts.factory` AST API, and TypeScript 7.0 ships no programmatic API at all (one
// returns in 7.1). Every package that compiles source pins typescript@7.0.2; this
// is the only place 5.9.3 exists, and it is not reachable as a binary from any of
// them. Delete this whole directory when openapi-typescript adopts the TypeScript 7
// API and move openapi-typescript into contract's devDependencies.
//
// The CLI path is read from openapi-typescript's own `bin` field rather than
// hardcoded, so a reorganisation of its internals cannot break us.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('openapi-typescript/package.json');
const { bin } = require(pkgPath);
const cli = new URL(
  typeof bin === 'string' ? bin : bin['openapi-typescript'],
  pathToFileURL(pkgPath),
);
await import(cli.href);
