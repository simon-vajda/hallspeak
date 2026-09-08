/**
 * Sent in the socket handshake and checked against the server's MIN_CLIENT_VERSION. Strict
 * x.y.z, no prerelease: the Handshake schema rejects anything else as invalid_handshake.
 *
 * Deliberately not the version in `app.json`. That one is what a store shows a guest and
 * moves for reasons the protocol does not care about; sending it would refuse every
 * connection with `client_too_old`.
 */
export const CLIENT_VERSION = '0.2.0';
