import { parseListenerLink } from '@/links/parse';
import { channelHref, eventHref } from '@/links/route';

/** The shared app-link host wraps a self-hosted event or channel URL. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // Keep existing app paths and the development client's launch scheme working.
    if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/?')) {
      return path;
    }
    const incoming = new URL(path, 'https://open.linguacast.app');
    if (incoming.protocol === 'linguacast:') {
      return path;
    }
    if (incoming.origin !== 'https://open.linguacast.app' || incoming.pathname !== '/') {
      return '/';
    }

    const parsed = parseListenerLink(incoming.searchParams.get('url') ?? '');
    if (!parsed.ok) {
      return '/';
    }

    const { host, pin, slug } = parsed.destination;
    return String(slug === null ? eventHref(host, pin) : channelHref(host, pin, slug));
  } catch {
    // External input must never crash routing, on a cold launch or while already running.
    return '/';
  }
}
