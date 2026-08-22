// No zod import: reachable from the browser as '@linguacast/contract/patterns', where
// the root barrel and './schemas' would both pull Hono into the bundle.

export const PIN_PATTERN = /^\d{6}$/;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

// The drawn checklist is three lines, so there are three rules. A space counts as the
// special character: refusing it would reject `correct horse battery 9` while accepting
// `password9!`, which is the weaker of the two.
export const PASSWORD_MIN_LENGTH = 8;

// A request-size safety bound, not a fourth checklist rule.
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_NUMBER_PATTERN = /\d/;

export const PASSWORD_SPECIAL_PATTERN = /[^A-Za-z0-9]/;
