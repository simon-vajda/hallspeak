import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const TRACKS = {
  server: { manifest: 'apps/server/package.json', tagPrefix: 'server-v' },
  mobile: { manifest: 'apps/mobile/package.json', tagPrefix: 'mobile-v' },
};

const PRIVATE_MANIFESTS = [
  'package.json',
  'apps/web/package.json',
  'packages/contract/package.json',
  'packages/client-core/package.json',
  'tools/openapi-codegen/package.json',
];

export function parseVersion(version) {
  const match = STABLE_SEMVER.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new Error('Versions must use strict stable X.Y.Z SemVer.');
  }
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

const COMPATIBILITY_CONSTANTS = [
  {
    file: 'packages/client-core/src/server/compatibility.ts',
    constant: 'MIN_SERVER_VERSION',
    track: 'server',
  },
  {
    file: 'apps/server/src/version.ts',
    constant: 'MIN_MOBILE_VERSION',
    track: 'mobile',
  },
];

async function json(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

export async function currentVersion(root, track) {
  const config = TRACKS[track];
  if (!config) {
    throw new Error(`Unknown release track: ${track}`);
  }
  return (await json(root, config.manifest)).version;
}

export async function checkRepository(root) {
  const errors = [];
  for (const relativePath of PRIVATE_MANIFESTS) {
    const manifest = await json(root, relativePath);
    if (manifest.version !== '0.0.0') {
      errors.push(`${relativePath} must stay at 0.0.0; found ${manifest.version}`);
    }
  }

  const serverVersion = await currentVersion(root, 'server');
  const mobileVersion = await currentVersion(root, 'mobile');
  for (const [track, version] of [
    ['server', serverVersion],
    ['mobile', mobileVersion],
  ]) {
    if (!STABLE_SEMVER.test(version)) {
      errors.push(`${track} version must use strict stable X.Y.Z SemVer; found ${version}`);
    }
  }

  const env = await readFile(path.join(root, '.env.example'), 'utf8');
  const envVersion = /^LINGUACAST_VERSION=(.+)$/m.exec(env)?.[1];
  if (envVersion !== serverVersion) {
    errors.push(`.env.example pins ${envVersion ?? 'nothing'}; server is ${serverVersion}`);
  }

  const openapi = await json(root, 'packages/contract/openapi.json');
  if (openapi.info?.version !== serverVersion) {
    errors.push(
      `OpenAPI reports ${openapi.info?.version ?? 'nothing'}; server is ${serverVersion}`,
    );
  }

  // Two hand-written floors in two packages decide whether a released client and a released
  // server may talk. Nothing else notices when one of them passes its own track's version.
  for (const entry of COMPATIBILITY_CONSTANTS) {
    const source = await readFile(path.join(root, entry.file), 'utf8');
    const declared = new RegExp(`${entry.constant}\\s*(?::[^=]*)?=\\s*'([^']+)'`).exec(source)?.[1];
    const ceiling = entry.track === 'server' ? serverVersion : mobileVersion;
    if (declared === undefined) {
      errors.push(`${entry.file} declares no ${entry.constant}`);
    } else if (!STABLE_SEMVER.test(declared)) {
      errors.push(`${entry.constant} must use strict stable X.Y.Z SemVer; found ${declared}`);
    } else if (compareVersions(declared, ceiling) > 0) {
      errors.push(
        `${entry.constant} is ahead of the ${entry.track} it must accept: ${declared} > ${ceiling}`,
      );
    }
  }

  const app = await json(root, 'apps/mobile/app.json');
  if (Object.hasOwn(app.expo ?? {}, 'version')) {
    errors.push('apps/mobile/app.json must not mirror version; app.config.ts derives it');
  }

  return { errors, serverVersion, mobileVersion };
}

export function validateReleaseTag(track, tag, version) {
  const config = TRACKS[track];
  if (!config) {
    throw new Error(`Unknown release track: ${track}`);
  }
  const expected = `${config.tagPrefix}${version}`;
  if (tag !== expected) {
    throw new Error(`Tag ${tag} does not match ${config.manifest} (${expected}).`);
  }
  return version;
}

export async function writeVersionFiles(root, track, nextVersion) {
  const config = TRACKS[track];
  if (!config) {
    throw new Error(`Unknown release track: ${track}`);
  }
  const manifestPath = path.join(root, config.manifest);
  const manifest = await json(root, config.manifest);
  manifest.version = nextVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (track === 'server') {
    const envPath = path.join(root, '.env.example');
    const env = await readFile(envPath, 'utf8');
    if (!/^LINGUACAST_VERSION=.+$/m.test(env)) {
      throw new Error('.env.example has no LINGUACAST_VERSION assignment.');
    }
    await writeFile(
      envPath,
      env.replace(/^LINGUACAST_VERSION=.+$/m, `LINGUACAST_VERSION=${nextVersion}`),
    );
  }
}
