import { parseListenerLink } from '@/links/parse';
import { destinationHref } from '@/links/route';

/** The shared app-link host wraps a self-hosted event or channel URL. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // Keep existing app paths and the development client's launch scheme working; the
    // development variant registers its own scheme so it can install beside the store app.
    if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/?')) {
      return path;
    }
    const incoming = new URL(path, 'https://open.hallspeak.app');
    if (incoming.protocol === 'hallspeak:' || incoming.protocol === 'hallspeak-dev:') {
      return path;
    }
    if (incoming.origin !== 'https://open.hallspeak.app' || incoming.pathname !== '/') {
      return '/';
    }

    const parsed = parseListenerLink(incoming.searchParams.get('url') ?? '');
    if (!parsed.ok) {
      return '/';
    }

    return String(destinationHref(parsed.destination, parsed.speakerCode));
  } catch {
    // External input must never crash routing, on a cold launch or while already running.
    return '/';
  }
}
