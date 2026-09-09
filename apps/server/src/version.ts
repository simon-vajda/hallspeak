import serverManifest from '../package.json' with { type: 'json' };

/** One release version for server and bundled web. Canonical value lives in package.json. */
export const SERVER_VERSION = serverManifest.version;

/** Oldest independently released mobile app this server accepts. */
export const MIN_MOBILE_VERSION = '0.1.0';
