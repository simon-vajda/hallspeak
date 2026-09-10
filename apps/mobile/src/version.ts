import mobileManifest from '../package.json';

/** Independent mobile artifact version, also shown by Expo and public stores. */
export const CLIENT_VERSION = mobileManifest.version;

// Metro inlines EXPO_PUBLIC_* at bundle time, which is the only way a build-time value
// reaches the bundle without widening app.config.ts. Empty when the build had no
// repository to read.
const COMMIT = process.env.EXPO_PUBLIC_COMMIT ?? '';

/**
 * Display only. The handshake and the store version both consume CLIENT_VERSION, which must
 * stay bare semver, so the commit travels beside it rather than inside it.
 */
export const BUILD_LABEL = COMMIT ? `v${CLIENT_VERSION} · ${COMMIT}` : `v${CLIENT_VERSION}`;
