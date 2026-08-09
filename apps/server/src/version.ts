/** Version of the HTTP API surface. Bumped when the contract changes incompatibly. */
export const API_VERSION = '1.0.0';

/**
 * Oldest client build this server will talk to. Published by GET /api/version and
 * enforced in the socket handshake (ADR §7) — that gate arrives in Spec C.
 */
export const MIN_CLIENT_VERSION = '0.1.0';

/** Build identity of this server. */
export const SERVER_VERSION = '0.1.0';
