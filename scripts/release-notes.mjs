#!/usr/bin/env node
import { execFile } from 'node:child_process';
import process from 'node:process';
import { parseArgs, promisify } from 'node:util';
import {
  formatAuthor,
  LOG_FORMAT,
  parseLog,
  prNumber,
  renderMarkdown,
} from './release-notes-lib.mjs';
import { TRACKS } from './versioning-lib.mjs';

const USAGE =
  'Usage: node scripts/release-notes.mjs <server|mobile> --to <commit> [--from <tag>] [--tag <new tag>] [--json]';
const run = promisify(execFile);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function output(command, args) {
  try {
    return (await run(command, args, { maxBuffer: 16 * 1024 * 1024 })).stdout;
  } catch (error) {
    fail(`${command} ${args[0]} failed: ${error.stderr?.trim() || error.message}`);
  }
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      to: { type: 'string' },
      from: { type: 'string' },
      tag: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
} catch (error) {
  fail(`${error.message}\n${USAGE}`);
}

const { positionals, values } = parsed;
const [track] = positionals;
const config = TRACKS[track];
if (!config || positionals.length !== 1) {
  fail(USAGE);
}
if (!values.to) {
  fail(`--to is required.\n${USAGE}`);
}

const range = values.from ? `${values.from}..${values.to}` : values.to;
const commits = parseLog(
  await output('git', [
    'log',
    '--first-parent',
    '--reverse',
    `--format=${LOG_FORMAT}`,
    range,
    '--',
    ...config.paths,
  ]),
);

const entries = [];
for (const commit of commits) {
  const pr = prNumber(commit.subject);
  if (pr === null) {
    entries.push({
      sha: commit.sha,
      pr,
      title: commit.subject,
      author: commit.authorName,
      url: null,
    });
    continue;
  }
  const view = JSON.parse(
    await output('gh', ['pr', 'view', String(pr), '--json', 'author,url,title']),
  );
  entries.push({
    sha: commit.sha,
    pr,
    title: view.title,
    author: formatAuthor(view.author),
    url: view.url,
  });
}

if (values.json) {
  const result = { track, from: values.from ?? null, to: values.to, entries };
  console.log(JSON.stringify(result, null, 2));
} else {
  let repo = process.env.GITHUB_REPOSITORY;
  if (!repo && values.from && values.tag) {
    repo = (
      await output('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
    ).trim();
  }
  process.stdout.write(renderMarkdown(entries, { repo, from: values.from, tag: values.tag }));
}
