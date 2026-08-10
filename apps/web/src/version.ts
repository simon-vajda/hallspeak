/**
 * Sent in the socket handshake and checked against the server's MIN_CLIENT_VERSION.
 * Must be strict x.y.z with no prerelease — the Handshake schema rejects anything else
 * as invalid_handshake. Bump when this client stops being compatible with older servers.
 */
export const CLIENT_VERSION = '0.1.0';
