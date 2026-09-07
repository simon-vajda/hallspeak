/** A host as it may appear inside a path segment: a domain, optionally with a port. */
const HOST_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?$/;

export function isListenerHost(value: string): boolean {
  return HOST_PATTERN.test(value);
}

/**
 * The bare domain a history row shows: no scheme and no path, but the port kept, because a
 * self-hosted server on a non-default port is a different server.
 */
export function displayHost(value: string): string {
  const withoutScheme = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const authority = withoutScheme.split(/[/?#]/, 1)[0] ?? '';

  return authority.replace(/^[^@]*@/, '').toLowerCase();
}
