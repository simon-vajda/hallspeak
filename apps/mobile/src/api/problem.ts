import type { components } from '@linguacast/contract/openapi';

export type Problem = components['schemas']['Problem'];

/** `unavailable` means the API never answered. Every other error carries a Problem it wrote. */
export function unavailable(status: number, message: string): Response {
  return new Response(JSON.stringify({ code: 'unavailable', message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The one message a screen shows for any failure. React Native reports an untrusted
 * certificate and an unreachable host identically (facebook/react-native#13363), and the
 * server answers a disabled event and an unknown PIN with byte-identical 404s on purpose —
 * so naming a cause here would be a guess dressed as an explanation.
 */
export const GENERIC_FAILURE_MESSAGE =
  'This event could not be opened. Check the link and try again.';
