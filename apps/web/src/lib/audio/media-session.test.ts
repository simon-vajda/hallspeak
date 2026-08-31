import { describe, expect, it } from 'vitest';
import { listenerMediaPlaybackState } from './media-session';

describe('listener Media Session playback state', () => {
  it('withholds a session while the channel cannot play', () => {
    expect(listenerMediaPlaybackState(false, true)).toBe('none');
    expect(listenerMediaPlaybackState(false, false)).toBe('none');
  });

  it('reports an available but paused media element as paused', () => {
    expect(listenerMediaPlaybackState(true, true)).toBe('paused');
  });

  it('reports playing only when the available media element is playing', () => {
    expect(listenerMediaPlaybackState(true, false)).toBe('playing');
  });
});
