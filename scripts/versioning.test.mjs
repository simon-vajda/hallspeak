import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  checkRepository,
  compareVersions,
  STABLE_SEMVER,
  validateReleaseTag,
  writeVersionFiles,
} from './versioning-lib.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const CONSTANTS = {
  'packages/client-core/src/server/compatibility.ts': 'MIN_SERVER_VERSION',
  'apps/server/src/version.ts': 'MIN_MOBILE_VERSION',
};

async function writeSource(root, relativePath, version) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `export const ${CONSTANTS[relativePath]} = '${version}';\n`);
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'linguacast-versioning-'));
  roots.push(root);
  const manifests = [
    ['package.json', '0.0.0'],
    ['apps/server/package.json', '0.4.0'],
    ['apps/mobile/package.json', '0.1.0'],
    ['apps/web/package.json', '0.0.0'],
    ['packages/contract/package.json', '0.0.0'],
    ['packages/client-core/package.json', '0.0.0'],
    ['tools/openapi-codegen/package.json', '0.0.0'],
  ];
  for (const [relativePath, version] of manifests) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify({ version })}\n`);
  }
  await writeFile(path.join(root, '.env.example'), 'LINGUACAST_VERSION=0.4.0\n');
  await writeFile(
    path.join(root, 'packages/contract/openapi.json'),
    `${JSON.stringify({ info: { version: '0.4.0' } })}\n`,
  );
  await writeFile(path.join(root, 'apps/mobile/app.json'), '{"expo":{}}\n');
  await writeSource(root, 'packages/client-core/src/server/compatibility.ts', '0.4.0');
  await writeSource(root, 'apps/server/src/version.ts', '0.1.0');
  return root;
}

describe('stable versions', () => {
  it('accepts strict releases and compares numerically', () => {
    assert.equal(STABLE_SEMVER.test('1.10.0'), true);
    assert.equal(STABLE_SEMVER.test('1.10.0-rc.1'), false);
    assert.equal(STABLE_SEMVER.test('01.0.0'), false);
    assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  });
});

describe('repository consistency', () => {
  it('accepts canonical versions and catches stale mirrors', async () => {
    const root = await fixture();
    assert.deepEqual((await checkRepository(root)).errors, []);
    await writeFile(path.join(root, '.env.example'), 'LINGUACAST_VERSION=0.3.0\n');
    assert.match((await checkRepository(root)).errors.join('\n'), /\.env\.example pins 0\.3\.0/);
  });

  it('catches a compatibility floor that has passed its own track', async () => {
    const root = await fixture();
    await writeSource(root, 'packages/client-core/src/server/compatibility.ts', '0.5.0');
    assert.match(
      (await checkRepository(root)).errors.join('\n'),
      /MIN_SERVER_VERSION is ahead of the server it must accept: 0\.5\.0 > 0\.4\.0/,
    );

    const other = await fixture();
    await writeSource(other, 'apps/server/src/version.ts', '0.2.0');
    assert.match(
      (await checkRepository(other)).errors.join('\n'),
      /MIN_MOBILE_VERSION is ahead of the mobile it must accept: 0\.2\.0 > 0\.1\.0/,
    );
  });

  it('accepts a floor behind its own track and rejects a missing one', async () => {
    const root = await fixture();
    await writeSource(root, 'packages/client-core/src/server/compatibility.ts', '0.3.0');
    assert.deepEqual((await checkRepository(root)).errors, []);

    await writeFile(
      path.join(root, 'apps/server/src/version.ts'),
      'export const SERVER_VERSION = manifest.version;\n',
    );
    assert.match((await checkRepository(root)).errors.join('\n'), /declares no MIN_MOBILE_VERSION/);
  });

  it('updates only files owned by each track', async () => {
    const root = await fixture();
    await writeVersionFiles(root, 'mobile', '0.2.0');
    assert.equal(
      JSON.parse(await readFile(path.join(root, 'apps/mobile/package.json'))).version,
      '0.2.0',
    );
    assert.equal(
      await readFile(path.join(root, '.env.example'), 'utf8'),
      'LINGUACAST_VERSION=0.4.0\n',
    );
    await writeVersionFiles(root, 'server', '0.5.0');
    assert.equal(
      await readFile(path.join(root, '.env.example'), 'utf8'),
      'LINGUACAST_VERSION=0.5.0\n',
    );
  });
});

describe('release tags', () => {
  it('requires track prefix and exact manifest version', () => {
    assert.equal(validateReleaseTag('server', 'server-v1.5.2', '1.5.2'), '1.5.2');
    assert.throws(() => validateReleaseTag('server', 'mobile-v1.5.2', '1.5.2'));
    assert.throws(() => validateReleaseTag('mobile', 'mobile-v1.2.1', '1.2.0'));
  });
});
