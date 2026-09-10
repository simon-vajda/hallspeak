import { describe, expect, it } from 'vitest';
import { appListenerLink, isPhoneBrowser } from './app-notice';

describe('phone app promotion', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/140.0 Mobile Safari/537.36',
  ])('includes phone browser %s', (agent) => expect(isPhoneBrowser(agent)).toBe(true));

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Tablet) Chrome/140.0 Safari/537.36',
  ])('excludes desktop and tablet browser %s', (agent) =>
    expect(isPhoneBrowser(agent)).toBe(false),
  );

  it('encodes the complete URL once, including query and fragment', () => {
    const channel = 'https://church.example:8443/events/481209/espanol?source=a&name=b%20c#listen';
    const link = new URL(appListenerLink(channel));
    expect(link.origin).toBe('https://open.linguacast.app');
    expect(link.searchParams.get('url')).toBe(channel);
    expect([...link.searchParams.keys()]).toEqual(['url']);
  });
});
