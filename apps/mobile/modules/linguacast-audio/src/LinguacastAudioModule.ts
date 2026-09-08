import { NativeModule, requireNativeModule } from 'expo';
import type { LinguacastAudioModuleEvents } from './LinguacastAudio.types';

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

  /** The name the platform gives the output currently carrying the audio. */
  currentRoute(): string | null;
}

export default requireNativeModule<LinguacastAudioModule>('LinguacastAudio');
