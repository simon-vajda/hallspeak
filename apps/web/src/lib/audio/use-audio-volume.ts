import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_VOLUME_STORAGE_KEY,
  changeAudioVolume,
  createAudioVolumeState,
  mediaElementVolume,
  parseStoredVolume,
  serializeVolume,
  toggleAudioMute,
} from './volume';

// Slider emits every pointer move. Keep synchronous storage writes outside the drag path.
const WRITE_DEBOUNCE_MS = 300;

function readStoredVolume(): number {
  try {
    return parseStoredVolume(localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY));
  } catch {
    return parseStoredVolume(null);
  }
}

function writeStoredVolume(volume: number) {
  try {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, serializeVolume(volume));
  } catch {
    // Blocked storage: volume still applies for this page lifetime.
  }
}

/** Owns browser-wide listener volume and applies it to the room's media element. */
export function useAudioVolume(audio: RefObject<HTMLAudioElement | null>) {
  const [state, setState] = useState(() => createAudioVolumeState(readStoredVolume()));
  const latest = useRef(state.volume);
  latest.current = state.volume;
  const persisted = useRef(state.volume);
  const pending = useRef(false);

  useEffect(() => {
    const element = audio.current;
    if (element) {
      element.volume = mediaElementVolume(state.volume);
    }
  }, [audio, state.volume]);

  useEffect(() => {
    if (state.volume === persisted.current) {
      pending.current = false;
      return;
    }

    pending.current = true;
    const timer = setTimeout(() => {
      pending.current = false;
      writeStoredVolume(state.volume);
      persisted.current = state.volume;
    }, WRITE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.volume]);

  useEffect(() => {
    const flush = () => {
      if (!pending.current) {
        return;
      }
      pending.current = false;
      writeStoredVolume(latest.current);
      persisted.current = latest.current;
    };

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((previous) => changeAudioVolume(previous, volume));
  }, []);
  const toggleMute = useCallback(() => {
    setState((previous) => toggleAudioMute(previous));
  }, []);

  return {
    volume: state.volume,
    muted: state.volume === 0,
    setVolume,
    toggleMute,
  };
}
