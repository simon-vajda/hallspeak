import type { Context } from 'hono';

/** So a configured `127.0.0.1` still matches a connection arriving as `::ffff:127.0.0.1`. */
export function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

export function remoteAddress(c: Context): string | undefined {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  const remote = incoming?.socket?.remoteAddress;
  return remote ? normalizeAddress(remote) : undefined;
}

export function isTrustedProxy(
  address: string | undefined,
  trustedProxies: readonly string[],
): address is string {
  return address !== undefined && trustedProxies.includes(address);
}

/**
 * The origin the visitor typed. Forwarded scheme and host are believed only from a listed
 * proxy, as with X-Forwarded-For: a TLS-terminating proxy otherwise reads as plain http.
 */
export function publicOrigin(c: Context, trustedProxies: readonly string[]): string {
  const url = new URL(c.req.url);
  if (!isTrustedProxy(remoteAddress(c), trustedProxies)) {
    return url.origin;
  }
  const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? forwardedProto
      : url.protocol.slice(0, -1);
  const host = c.req.header('x-forwarded-host')?.split(',')[0]?.trim() || url.host;
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return url.origin;
  }
}
