#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  checkRepository,
  compareVersions,
  currentVersion,
  STABLE_SEMVER,
  TRACKS,
  validateReleaseTag,
  writeVersionFiles,
} from './versioning-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const [command, track, argument] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function check() {
  const result = await checkRepository(root);
  if (result.errors.length > 0) {
    fail(result.errors.join('\n'));
  }
  console.log(`server ${result.serverVersion}`);
  console.log(`mobile ${result.mobileVersion}`);
  console.log('version sources consistent');
}

async function run(commandName, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${commandName} exited with ${code}`)),
    );
  });
}

async function bump() {
  const config = TRACKS[track];
  if (!config) {
    fail('Usage: pnpm version:server [X.Y.Z] or pnpm version:mobile [X.Y.Z]');
  }

  const current = await currentVersion(root, track);
  console.log(`Current ${track} version: ${current}`);

  let next = argument;
  let interactive = false;
  let prompt;
  if (next === undefined) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      fail('New version required when no interactive terminal is attached.');
    }
    interactive = true;
    prompt = createInterface({ input: process.stdin, output: process.stdout });
    next = (await prompt.question('New version: ')).trim();
  }

  if (!STABLE_SEMVER.test(next)) {
    prompt?.close();
    fail('New version must use strict stable X.Y.Z SemVer.');
  }
  if (compareVersions(next, current) <= 0) {
    prompt?.close();
    fail(`New version must be greater than ${current}.`);
  }

  const changed =
    track === 'server'
      ? [
          config.manifest,
          '.env.example',
          'packages/contract/openapi.json',
          'packages/contract/src/generated/api.d.ts',
        ]
      : [config.manifest];
  console.log(`New ${track} version: ${next}`);
  console.log(`Files:\n${changed.map((file) => `  ${file}`).join('\n')}`);
  console.log(`Expected tag: ${config.tagPrefix}${next}`);

  if (interactive) {
    const answer = (await prompt.question('Apply changes? [y/N] ')).trim().toLowerCase();
    prompt.close();
    if (answer !== 'y' && answer !== 'yes') {
      console.log('No files changed.');
      return;
    }
  }

  const backups = new Map();
  for (const relativePath of changed) {
    backups.set(relativePath, await readFile(path.join(root, relativePath), 'utf8'));
  }

  try {
    await writeVersionFiles(root, track, next);
    if (track === 'server') {
      await run(process.execPath, [
        require.resolve('tsx/cli'),
        path.join(root, 'packages/contract/scripts/gen.ts'),
      ]);
      await run(process.execPath, [
        path.join(root, 'tools/openapi-codegen/bin.mjs'),
        path.join(root, 'packages/contract/openapi.json'),
        '-o',
        path.join(root, 'packages/contract/src/generated/api.d.ts'),
      ]);
    }
    const result = await checkRepository(root);
    if (result.errors.length > 0) {
      throw new Error(result.errors.join('\n'));
    }
  } catch (error) {
    await Promise.all(
      [...backups].map(([relativePath, contents]) =>
        writeFile(path.join(root, relativePath), contents),
      ),
    );
    fail(
      `Version bump failed; restored changed files.\n${error instanceof Error ? error.message : error}`,
    );
  }

  console.log(`Updated ${track} ${current} to ${next}.`);
  console.log(`Review changes, commit, then tag ${config.tagPrefix}${next}.`);
}

async function releaseTag() {
  if (!track || !argument) {
    fail('Usage: node scripts/versioning.mjs release-tag <server|mobile> <tag>');
  }
  const version = await currentVersion(root, track);
  console.log(validateReleaseTag(track, argument, version));
}

if (command === 'check') {
  await check();
} else if (command === 'bump') {
  await bump();
} else if (command === 'release-tag') {
  await releaseTag();
} else {
  fail('Usage: node scripts/versioning.mjs <check|bump|release-tag>');
}
