const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * The oldest server this mobile release will talk to at all. Policy, not a feature test:
 * it moves only when a server major is dropped, so a capability added later must not raise
 * it and lock out servers that are otherwise fine.
 */
export const MIN_SERVER_VERSION = '0.4.0';

/**
 * Feature selection only, never the floor. Both values coincide today because the mobile
 * listener is what opened this track; they are free to diverge the moment a second entry
 * lands, which is the whole reason they are separate constants.
 */
export const SERVER_CAPABILITIES = {
  mobileListener: '0.4.0',
} as const;

export type ServerCapability = keyof typeof SERVER_CAPABILITIES;

/** Explicit because mobile and server major versions are independent release tracks. */
export const SUPPORTED_SERVER_MAJORS = [0] as const;

export interface ServerVersionInfo {
  serverVersion: string;
  minMobileVersion: string;
}

export type ServerCompatibility =
  | 'supported'
  | 'invalid-version'
  | 'mobile-too-old'
  | 'server-too-old'
  | 'server-too-new';

function tuple(version: string): readonly [number, number, number] | null {
  const match = STABLE_VERSION.exec(version);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function hasServerCapability(version: string, capability: ServerCapability): boolean {
  const actual = tuple(version);
  const required = tuple(SERVER_CAPABILITIES[capability]);
  return actual !== null && required !== null && compare(actual, required) >= 0;
}

/**
 * Mobile runs this once per host before event API calls or a socket connection.
 *
 * Precedence is fixed and tested: malformed input first, because nothing below can be
 * trusted without it; then the server's own floor, which is the one verdict the guest
 * cannot act on by updating the app; then the major window, which is coarse; then this
 * release's minimum server, which is fine-grained within a supported major.
 */
export function assessServerCompatibility(
  info: ServerVersionInfo,
  mobileVersion: string,
): ServerCompatibility {
  const server = tuple(info.serverVersion);
  const minimumMobile = tuple(info.minMobileVersion);
  const mobile = tuple(mobileVersion);
  if (!server || !minimumMobile || !mobile) {
    return 'invalid-version';
  }
  if (compare(mobile, minimumMobile) < 0) {
    return 'mobile-too-old';
  }

  const majors = SUPPORTED_SERVER_MAJORS as readonly number[];
  if (!majors.includes(server[0])) {
    return server[0] < Math.min(...majors) ? 'server-too-old' : 'server-too-new';
  }

  const minimumServer = tuple(MIN_SERVER_VERSION);
  if (minimumServer && compare(server, minimumServer) < 0) {
    return 'server-too-old';
  }

  return 'supported';
}
