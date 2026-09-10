import serverManifest from '../../server/package.json';

/** Web ships inside server image and must match that server exactly. */
export const CLIENT_VERSION = serverManifest.version;

// Replaced at build time by Vite's define; `typeof` keeps this file loadable in a plain
// Node context, where no replacement happens.
const COMMIT = typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : '';

/**
 * Display only. The handshake compares CLIENT_VERSION, which must stay bare semver, so the
 * commit travels beside it rather than inside it. Empty when the build had no repository
 * and was given no commit, which is preferable to printing a placeholder.
 */
export const BUILD_LABEL = COMMIT ? `v${CLIENT_VERSION} · ${COMMIT}` : `v${CLIENT_VERSION}`;
