import { useEffect } from 'react';
import LinguacastAudio from '../../modules/linguacast-audio';
import type { SystemControls } from './now-playing';

/**
 * Holds the platform's audio session and its media controls in step with playback intent.
 *
 * The session spans the playback hold deliberately (`systemControls` decides that): Android
 * refuses to start a foreground service from the background, so a hold that deactivated
 * could not start one again when the interpreter returned.
 */
export function useNowPlaying(
  controls: SystemControls,
  handlers: { onPlay: () => void; onPause: () => void },
): void {
  const { active, playing } = controls;
  const title = controls.nowPlaying?.title ?? '';
  const artist = controls.nowPlaying?.artist ?? '';

  useEffect(() => {
    if (!active) {
      void LinguacastAudio.clearNowPlaying().catch(report);
      void LinguacastAudio.deactivate().catch(report);
      return;
    }

    void LinguacastAudio.activate()
      .then(() => LinguacastAudio.setNowPlaying({ title, artist }))
      .catch(report);
  }, [active, title, artist]);

  useEffect(() => {
    if (!active) {
      return;
    }

    void LinguacastAudio.setPlaybackState(playing).catch(report);
  }, [active, playing]);

  // Routed into the same handlers the in-app target uses, so the two can never disagree.
  const { onPlay, onPause } = handlers;
  useEffect(() => {
    const play = LinguacastAudio.addListener('onRemotePlay', onPlay);
    const pause = LinguacastAudio.addListener('onRemotePause', onPause);

    return () => {
      play.remove();
      pause.remove();
    };
  }, [onPlay, onPause]);

  // The controls must not outlive the screen that published them.
  useEffect(
    () => () => {
      void LinguacastAudio.clearNowPlaying().catch(report);
      void LinguacastAudio.deactivate().catch(report);
    },
    [],
  );
}

function report(cause: unknown): void {
  console.error('audio: the listening session could not be updated', cause);
}
