import { NativeModule, requireNativeModule } from 'expo';
import type { LinguacastAudioModuleEvents, NowPlayingInfo } from './LinguacastAudio.types';

declare class LinguacastAudioModule extends NativeModule<LinguacastAudioModuleEvents> {
  /**
   * Claims the platform's audio session for listening, and on Android starts the media
   * playback foreground service that keeps the process alive behind another app.
   *
   * Idempotent: calling it while already active is a no-op, which is what lets the playback
   * hold keep the session rather than stopping and restarting a foreground service Android
   * would refuse to start again from the background.
   */
  activate(): Promise<void>;

  /** Releases the session and, on Android, stops the service and its notification. */
  deactivate(): Promise<void>;

  /** Whether a session is currently held. */
  isActive(): boolean;

  /**
   * Publishes the platform's media controls. Play and pause only: no seek command is
   * enabled and the content is declared live, so no scrubber and no progress bar appear.
   */
  setNowPlaying(info: NowPlayingInfo): Promise<void>;

  /** Withdraws the controls. */
  clearNowPlaying(): Promise<void>;

  /** What the controls report. Paused is a state they show, not a reason to withdraw them. */
  setPlaybackState(playing: boolean): Promise<void>;

  /** The name the platform gives the output currently carrying the audio. */
  currentRoute(): string | null;

  /**
   * Presents the platform's own output chooser. Neither platform offers an app a general
   * enumerable list, so this app draws none and hands the question over.
   */
  presentOutputPicker(): Promise<void>;
}

export default requireNativeModule<LinguacastAudioModule>('LinguacastAudio');
