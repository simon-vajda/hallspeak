import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { createMediaSessionCarrierWave } from './media-session-carrier';

export interface MediaSessionCarrier {
  audio: RefObject<HTMLAudioElement | null>;
  play(): void;
  pause(): void;
}

/** Owns the looping file that asks Android for persistent media focus. */
export function useMediaSessionCarrier(): MediaSessionCarrier {
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audio.current;
    if (!element) {
      return;
    }

    const url = URL.createObjectURL(
      new Blob([createMediaSessionCarrierWave()], { type: 'audio/wav' }),
    );
    element.src = url;
    element.load();

    return () => {
      element.pause();
      element.removeAttribute('src');
      element.load();
      URL.revokeObjectURL(url);
    };
  }, []);

  const play = useCallback(() => {
    const element = audio.current;
    if (!element?.paused) {
      return;
    }
    void element
      .play()
      .catch((cause) => console.error('media: could not start audio carrier', cause));
  }, []);

  const pause = useCallback(() => audio.current?.pause(), []);

  return { audio, play, pause };
}
