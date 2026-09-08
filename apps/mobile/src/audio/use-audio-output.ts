import { useCallback, useEffect, useState } from 'react';
import LinguacastAudio from '../../modules/linguacast-audio';

export interface AudioOutput {
  /** What the platform calls the output carrying the audio, or null when it named none. */
  route: string | null;
  present: () => void;
}

/** Reads the route the module reports, and re-reads it whenever the platform moves it. */
export function useAudioOutput(active: boolean): AudioOutput {
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setRoute(null);
      return;
    }

    setRoute(LinguacastAudio.currentRoute());

    const subscription = LinguacastAudio.addListener('onRouteChange', ({ name }) => {
      setRoute(name);
    });

    return () => subscription.remove();
  }, [active]);

  const present = useCallback(() => {
    void LinguacastAudio.presentOutputPicker().catch((cause) => {
      console.warn('audio: could not open the output picker', cause);
    });
  }, []);

  return { route, present };
}
