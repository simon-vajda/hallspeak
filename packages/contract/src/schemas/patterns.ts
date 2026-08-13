// Plain constants, no zod import: these are shared by schemas built on
// @hono/zod-openapi (HTTP) and on bare zod (socket), and the socket path must not
// reach Hono. See the note in ../index.ts.
//
// Reachable from the browser as '@linguacast/contract/patterns', for the same reason
// './socket' exists: both the root barrel and './schemas' transitively import
// @hono/zod-openapi, so importing a pattern from either would pull Hono into the web
// bundle. The subpath keeps the contract's one-way dependency shape intact.

/** Six digits — read aloud in a room and typed on a numeric keypad (spec E §3). */
export const PIN_PATTERN = /^\d{6}$/;

/** Lowercase kebab-case. Immutable once a channel exists (spec E §2). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Strict x.y.z, no prerelease — see the Handshake schema for why. */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
