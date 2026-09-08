import type { ListenActionState } from '@linguacast/client-core/channel';

export interface NowPlaying {
  /** The channel, which is what a guest chose. */
  title: string;
  /** The event beneath it, which is where they are. */
  artist: string;
}

export interface SystemControls {
  /** Whether the session and, on Android, the foreground service should be held. */
  active: boolean;
  /** Null when no controls should be shown at all. */
  nowPlaying: NowPlaying | null;
  /**
   * What the controls report. Paused rather than absent while a consumer is being opened
   * or while the playback hold is running: withdrawing them at either moment would take
   * away the control a guest reaches for exactly then.
   */
  playing: boolean;
}

const WITHDRAWN: SystemControls = { active: false, nowPlaying: null, playing: false };

/**
 * What the platform's media controls should say, derived from state that already exists.
 * Kept pure and beside the hook so every state is covered without rendering anything.
 *
 * The session spans the playback hold deliberately: Android refuses to start a foreground
 * service from the background, so a hold that deactivated could not start one again when
 * the interpreter returned.
 */
export function systemControls(input: {
  actionState: ListenActionState;
  /** A resumed consumer exists, not that the target was pressed. */
  isPlaying: boolean;
  channelName: string;
  eventName: string;
}): SystemControls {
  if (input.actionState === 'unavailable' || input.actionState === 'ready') {
    return WITHDRAWN;
  }

  return {
    active: true,
    nowPlaying: { title: input.channelName, artist: input.eventName },
    playing: input.actionState === 'playing' && input.isPlaying,
  };
}
