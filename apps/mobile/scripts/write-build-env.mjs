import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { buildEnvContents } from './build-env.mjs';

// EAS runs no package script that sets EXPO_PUBLIC_COMMIT, and eas.json cannot interpolate
// one, so the build hook hands the commit to Expo's env loader, which Metro inlines from.
const contents = buildEnvContents(process.env.EAS_BUILD_GIT_COMMIT_HASH);
if (contents) {
  writeFileSync(new URL('../.env.local', import.meta.url), contents);
}
