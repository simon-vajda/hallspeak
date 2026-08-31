export type ListenerMediaPlaybackState = 'none' | 'paused' | 'playing';

/**
 * Media Session reports the element's real playback, not merely an open Consumer. A platform
 * interruption can pause the element while the listener intent remains active for recovery.
 */
export function listenerMediaPlaybackState(
  available: boolean,
  elementPaused: boolean,
): ListenerMediaPlaybackState {
  if (!available) {
    return 'none';
  }
  return elementPaused ? 'paused' : 'playing';
}
