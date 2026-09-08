import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import LinguacastAudio from '../../modules/linguacast-audio';
import { normalizeVolume } from './system-audio';

export interface SystemAudio {
  /** What the platform calls the output carrying the audio, or null when it named none. */
  route: string | null;
  /** The device's own media volume, 0 to 100. */
  volume: number;
}

/**
 * Where the audio is going and how loud the device is. Both are read from the platform and
 * neither is set here: Android does not let an app choose the media output at all, and an
 * in-app level could only attenuate below the volume keys a guest is already holding.
 */
export function useSystemAudio(): SystemAudio {
  const [route, setRoute] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const read = useCallback(() => {
    setRoute(LinguacastAudio.currentRoute());
    setVolume(normalizeVolume(LinguacastAudio.systemVolume()));
  }, []);

  useEffect(() => {
    read();

    const volumes = LinguacastAudio.addListener('onVolumeChange', (event) =>
      setVolume(normalizeVolume(event.volume)),
    );
    // Read the level again rather than only the name: iOS keeps a volume per route, so a
    // headset arriving changes both at once and the level it reports is the old route's.
    const routes = LinguacastAudio.addListener('onRouteChange', read);

    // The change events do not arrive while the process is suspended, and Control Centre
    // and the volume keys both work over a backgrounded app — so what is on screen when a
    // guest comes back would otherwise be whatever was true when they left.
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        read();
      }
    });

    return () => {
      routes.remove();
      volumes.remove();
      foreground.remove();
    };
  }, [read]);

  return { route, volume };
}
