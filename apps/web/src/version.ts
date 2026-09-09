import serverManifest from '../../server/package.json';

/** Web ships inside server image and must match that server exactly. */
export const CLIENT_VERSION = serverManifest.version;
