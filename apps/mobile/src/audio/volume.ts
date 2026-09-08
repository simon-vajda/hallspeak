export const VOLUME_STORAGE_KEY = 'linguacast-audio-volume';

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

/** The web client's default, so a guest moving between clients hears the same thing. */
export const DEFAULT_VOLUME = 70;

/**
 * Silence has one representation, not two. A mute flag beside a volume lets the two disagree
 * — a slider at zero the app still calls unmuted — so muting is a move to zero that
 * remembers where it came from, and the speaker control and the slider read one value.
 */
export type VolumeState = {
  volume: number;
  lastAudible: number;
};

export const DEFAULT_VOLUME_STATE: VolumeState = {
  volume: DEFAULT_VOLUME,
  lastAudible: DEFAULT_VOLUME,
};

/** Whole percentages, including a value recovered from storage somebody edited by hand. */
export function normalizeVolume(value: unknown, fallback = DEFAULT_VOLUME): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(Math.min(Math.max(value, MIN_VOLUME), MAX_VOLUME));
}

export function setVolume(state: VolumeState, volume: number): VolumeState {
  const next = normalizeVolume(volume);

  return { volume: next, lastAudible: next > MIN_VOLUME ? next : state.lastAudible };
}

export function toggleMute(state: VolumeState): VolumeState {
  return isSilent(state)
    ? { volume: state.lastAudible, lastAudible: state.lastAudible }
    : { volume: MIN_VOLUME, lastAudible: state.volume };
}

/** True at zero however it got there: by the control, or by dragging the slider to the end. */
export const isSilent = (state: VolumeState): boolean => state.volume === MIN_VOLUME;

export function volumeLabel(state: VolumeState): string {
  return isSilent(state) ? 'Muted' : `${state.volume}%`;
}

/**
 * The track gain for a volume. `react-native-webrtc` accepts 0–10 on a remote audio track;
 * the headroom above unity stays unused, because amplifying an interpreter past what they
 * sent would amplify the room they are sitting in with them.
 */
export function trackGain(volume: number): number {
  return normalizeVolume(volume) / MAX_VOLUME;
}

export function parseStoredVolume(raw: string | null): VolumeState {
  if (raw === null) {
    return DEFAULT_VOLUME_STATE;
  }

  try {
    const volume = normalizeVolume(JSON.parse(raw));

    // A stored zero is a guest who left it muted, and it is honoured. Where they came from
    // is not stored with it: the restore value is worth only the session it was set in.
    return { volume, lastAudible: volume > MIN_VOLUME ? volume : DEFAULT_VOLUME };
  } catch {
    return DEFAULT_VOLUME_STATE;
  }
}

export function serializeVolume(state: VolumeState): string {
  return JSON.stringify(state.volume);
}
