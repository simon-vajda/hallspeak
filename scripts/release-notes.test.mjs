import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { formatAuthor, prNumber, renderMarkdown } from './release-notes-lib.mjs';

const run = promisify(execFile);
const script = fileURLToPath(new URL('./release-notes.mjs', import.meta.url));
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('pull request numbers', () => {
  it('takes the trailing squash reference only', () => {
    assert.equal(prNumber('fix(mobile): correct media state (#85)'), 85);
    assert.equal(prNumber('revert "feat: thing (#12)" (#85)'), 85);
    assert.equal(prNumber('chore: direct push'), null);
  });
});

describe('authors', () => {
  it('renders humans and bots as GitHub does', () => {
    assert.equal(formatAuthor({ login: 'simon-vajda', is_bot: false }), '@simon-vajda');
    assert.equal(formatAuthor({ login: 'app/dependabot', is_bot: true }), '@dependabot[bot]');
  });
});

describe('markdown', () => {
  const entries = [
    {
      sha: 'a'.repeat(40),
      pr: 85,
      title: 'fix(mobile): correct media state',
      author: '@simon-vajda',
      url: 'https://github.com/o/r/pull/85',
    },
    {
      sha: 'b'.repeat(40),
      pr: 86,
      title: 'chore(release): mobile v0.7.2',
      author: '@simon-vajda',
      url: 'https://github.com/o/r/pull/86',
    },
  ];

  it('lists entries in order and links the comparison', () => {
    assert.equal(
      renderMarkdown(entries, { repo: 'o/r', from: 'mobile-v0.7.1', tag: 'mobile-v0.7.2' }),
      [
        "## What's Changed",
        '* fix(mobile): correct media state by @simon-vajda in https://github.com/o/r/pull/85',
        '* chore(release): mobile v0.7.2 by @simon-vajda in https://github.com/o/r/pull/86',
        '',
        '**Full Changelog**: https://github.com/o/r/compare/mobile-v0.7.1...mobile-v0.7.2',
        '',
      ].join('\n'),
    );
  });

  it('omits the comparison without both ends', () => {
    for (const range of [{ tag: 'mobile-v0.7.2' }, { from: 'mobile-v0.7.1' }]) {
      assert.doesNotMatch(renderMarkdown(entries, { repo: 'o/r', ...range }), /Full Changelog/);
    }
  });

  it('names a direct push by short hash and git author', () => {
    const direct = {
      sha: 'c0ffee1234567890c0ffee1234567890c0ffee12',
      pr: null,
      title: 'chore: direct push',
      author: 'Simon Vajda',
      url: null,
    };
    assert.match(
      renderMarkdown([direct], {}),
      /^\* chore: direct push by Simon Vajda in c0ffee1$/m,
    );
  });
});

async function git(cwd, ...args) {
  return (await run('git', args, { cwd })).stdout.trim();
}

async function commit(cwd, file, subject) {
  const target = path.join(cwd, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${subject}\n`);
  await git(cwd, 'add', '--', file);
  await git(cwd, 'commit', '-q', '-m', subject);
  return git(cwd, 'rev-parse', 'HEAD');
}

async function repository() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'hallspeak-release-notes-'));
  roots.push(cwd);
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.name', 'Test Author');
  await git(cwd, 'config', 'user.email', 'test@example.com');
  await git(cwd, 'config', 'commit.gpgsign', 'false');
  const base = await commit(cwd, 'README.md', 'chore: initial');
  await commit(cwd, 'apps/web/index.ts', 'feat: web');
  await commit(cwd, '.github/dependabot.yml', 'ci: dependabot');
  await commit(cwd, 'packages/client-core/index.ts', 'feat: shared');
  const to = await commit(cwd, 'apps/mobile/index.ts', 'feat: mobile');
  return { cwd, base, to };
}

async function select(cwd, track, ...range) {
  const { stdout } = await run(process.execPath, [script, track, '--json', ...range], { cwd });
  return JSON.parse(stdout).entries.map((entry) => entry.title);
}

describe('track selection', () => {
  it('keeps the commits that touched each track, oldest first', async () => {
    const { cwd, base, to } = await repository();
    assert.deepEqual(await select(cwd, 'server', '--from', base, '--to', to), [
      'feat: web',
      'feat: shared',
    ]);
    assert.deepEqual(await select(cwd, 'mobile', '--from', base, '--to', to), [
      'feat: shared',
      'feat: mobile',
    ]);
  });

  it('covers everything up to the release commit without a previous release', async () => {
    const { cwd, to } = await repository();
    await writeFile(path.join(cwd, 'apps/mobile/later.ts'), 'later\n');
    await git(cwd, 'add', '--', 'apps/mobile/later.ts');
    await git(cwd, 'commit', '-q', '-m', 'feat: after the release');
    assert.deepEqual(await select(cwd, 'mobile', '--to', to), ['feat: shared', 'feat: mobile']);
  });
});
