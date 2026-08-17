// No zod import: reachable from the browser as '@linguacast/contract/patterns', where
// the root barrel and './schemas' would both pull Hono into the bundle.

export const PIN_PATTERN = /^\d{6}$/;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
