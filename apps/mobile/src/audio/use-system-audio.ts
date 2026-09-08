import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setRoute(LinguacastAudio.currentRoute());
    setVolume(normalizeVolume(LinguacastAudio.systemVolume()));

    const routes = LinguacastAudio.addListener('onRouteChange', ({ name }) => setRoute(name));
    const volumes = LinguacastAudio.addListener('onVolumeChange', (event) =>
      setVolume(normalizeVolume(event.volume)),
    );

    return () => {
      routes.remove();
      volumes.remove();
    };
  }, []);

  return { route, volume };
}
