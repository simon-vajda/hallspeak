import { describe, expect, it } from 'vitest';
import { appListenerLink } from './app-notice';

describe('phone app promotion', () => {
  it('encodes the complete URL once, including query and fragment', () => {
    const channel = 'https://church.example:8443/events/481209/espanol?source=a&name=b%20c#listen';
    const link = new URL(appListenerLink(channel));
    expect(link.origin).toBe('https://open.hallspeak.app');
    expect(link.searchParams.get('url')).toBe(channel);
    expect([...link.searchParams.keys()]).toEqual(['url']);
  });
});
