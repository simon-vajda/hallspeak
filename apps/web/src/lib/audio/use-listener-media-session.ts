import { type RefObject, useEffect, useEffectEvent } from 'react';
import { listenerMediaPlaybackState } from './media-session';

function currentMediaSession(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return null;
  }
  return navigator.mediaSession;
}

function setPlaybackState(session: MediaSession, available: boolean, elementPaused: boolean) {
  try {
    session.playbackState = listenerMediaPlaybackState(available, elementPaused);
  } catch {
    // Partial implementations may expose Media Session without every property working.
  }
}

function setActionHandler(
  session: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // Unsupported actions must not break playback on otherwise capable browsers.
  }
}

function setPositionState(session: MediaSession, state?: MediaPositionState) {
  try {
    session.setPositionState(state);
  } catch {
    // Position state remains best effort on partial implementations.
  }
}

/** Owns lock-screen metadata and controls for the mounted listener room. */
export function useListenerMediaSession({
  audio,
  available,
  channelName,
  eventName,
  onPlay,
  onPause,
}: {
  audio: RefObject<HTMLAudioElement | null>;
  available: boolean;
  channelName: string;
  eventName: string;
  onPlay: () => void;
  onPause: () => void;
}) {
  const syncPlaybackState = useEffectEvent((session: MediaSession, element: HTMLAudioElement) =>
    setPlaybackState(session, available, element.paused),
  );
  const handlePlay = useEffectEvent(onPlay);
  const handlePause = useEffectEvent(onPause);

  useEffect(() => {
    const session = currentMediaSession();
    const element = audio.current;
    if (!session || !element) {
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      try {
        session.metadata = new MediaMetadata({
          title: channelName,
          artist: eventName,
          album: 'LinguaCast',
        });
      } catch {
        // Metadata is optional; action controls and normal playback still work without it.
      }
    }
    // Logical content is a live interpretation, not the six-second carrier file. Infinity
    // asks supporting system UIs for a live, non-seekable presentation instead of a loop.
    setPositionState(session, {
      duration: Number.POSITIVE_INFINITY,
      playbackRate: 1,
      position: 0,
    });

    const sync = () => syncPlaybackState(session, element);
    const play = () => handlePlay();
    const pause = () => handlePause();

    setActionHandler(session, 'play', play);
    setActionHandler(session, 'pause', pause);
    element.addEventListener('playing', sync);
    element.addEventListener('pause', sync);
    element.addEventListener('emptied', sync);
    sync();

    return () => {
      element.removeEventListener('playing', sync);
      element.removeEventListener('pause', sync);
      element.removeEventListener('emptied', sync);
      setActionHandler(session, 'play', null);
      setActionHandler(session, 'pause', null);
      setPlaybackState(session, false, true);
      setPositionState(session);
      try {
        session.metadata = null;
      } catch {
        // Cleanup remains best effort on partial implementations.
      }
    };
  }, [audio, channelName, eventName]);

  useEffect(() => {
    const session = currentMediaSession();
    const element = audio.current;
    if (session && element) {
      setPlaybackState(session, available, element.paused);
    }
  }, [audio, available]);
}
