import { useCallback, useEffect, useState } from 'react';
import { readVolume, saveVolume } from './store';
import { setVolume as apply, toggleMute as toggle, trackGain, type VolumeState } from './volume';

export interface ListenerVolume {
  state: VolumeState;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

/**
 * The guest's own level, independent of the phone's volume keys. Owned one level above the
 * screen, because the Audio sheet is a separate route and two copies of this would disagree
 * the moment either moved.
 */
export function useListenerVolume(): ListenerVolume {
  const [state, setState] = useState<VolumeState>(readVolume);

  const setVolume = useCallback((volume: number) => {
    setState((current) => {
      const next = apply(current, volume);
      saveVolume(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setState((current) => {
      const next = toggle(current);
      saveVolume(next);
      return next;
    });
  }, []);

  return { state, setVolume, toggleMute };
}

/**
 * Applies the level as gain on the open track, and re-applies it on every track the session
 * opens: a transport rebuild and a channel switch each produce a new one, and a new track
 * starts at the library's own default rather than at the guest's.
 */
export function useTrackGain(track: MediaStreamTrack | null, volume: number): void {
  useEffect(() => {
    if (track) {
      setTrackGain(track, volume);
    }
  }, [track, volume]);
}

/**
 * `react-native-webrtc` exposes per-track gain as a private method with no stability
 * contract, which is why the dependency is pinned to an exact version. It is absent on a
 * local track and on any build that renamed it, so its absence is tolerated rather than
 * thrown: a guest who cannot change the level still hears the interpreter.
 */
function setTrackGain(track: MediaStreamTrack, volume: number): void {
  const gain = (track as unknown as { _setVolume?: (value: number) => void })._setVolume;

  if (typeof gain !== 'function') {
    console.warn('media: this react-native-webrtc build exposes no per-track volume');
    return;
  }

  gain.call(track, trackGain(volume));
}
