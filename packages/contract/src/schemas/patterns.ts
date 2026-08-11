// Plain constants, no zod import: these are shared by schemas built on
// @hono/zod-openapi (HTTP) and on bare zod (socket), and the socket path must not
// reach Hono. See the note in ../index.ts.

/** Six digits — read aloud in a room and typed on a numeric keypad (spec E §3). */
export const PIN_PATTERN = /^\d{6}$/;

/** Lowercase kebab-case. Immutable once a channel exists (spec E §2). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Strict x.y.z, no prerelease — see the Handshake schema for why. */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
