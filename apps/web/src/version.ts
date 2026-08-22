/**
 * Sent in the socket handshake and checked against the server's MIN_CLIENT_VERSION. Strict
 * x.y.z, no prerelease: the Handshake schema rejects anything else as invalid_handshake.
 */
export const CLIENT_VERSION = '0.2.0';
