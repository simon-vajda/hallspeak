export const AUDIO_VOLUME_STORAGE_KEY = 'linguacast-audio-volume';
export const DEFAULT_AUDIO_VOLUME = 70;
export const MIN_AUDIO_VOLUME = 0;
export const MAX_AUDIO_VOLUME = 100;

export type AudioVolumeState = {
  volume: number;
  lastAudibleVolume: number;
};

/** Slider values are whole percentages, including values recovered from edited storage. */
export function normalizeAudioVolume(value: unknown, fallback = DEFAULT_AUDIO_VOLUME): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(Math.min(Math.max(value, MIN_AUDIO_VOLUME), MAX_AUDIO_VOLUME));
}

export function parseStoredVolume(raw: string | null): number {
  if (raw === null) {
    return DEFAULT_AUDIO_VOLUME;
  }

  try {
    return normalizeAudioVolume(JSON.parse(raw));
  } catch {
    return DEFAULT_AUDIO_VOLUME;
  }
}

export function serializeVolume(volume: number): string {
  return JSON.stringify(normalizeAudioVolume(volume));
}

export function mediaElementVolume(volume: number): number {
  return normalizeAudioVolume(volume) / MAX_AUDIO_VOLUME;
}

export function createAudioVolumeState(volume: number): AudioVolumeState {
  const normalized = normalizeAudioVolume(volume);
  return {
    volume: normalized,
    lastAudibleVolume: normalized > 0 ? normalized : DEFAULT_AUDIO_VOLUME,
  };
}

export function changeAudioVolume(state: AudioVolumeState, volume: number): AudioVolumeState {
  const normalized = normalizeAudioVolume(volume);
  return {
    volume: normalized,
    lastAudibleVolume: normalized > 0 ? normalized : state.lastAudibleVolume,
  };
}

export function toggleAudioMute(state: AudioVolumeState): AudioVolumeState {
  if (state.volume === 0) {
    return changeAudioVolume(state, state.lastAudibleVolume);
  }
  return { volume: 0, lastAudibleVolume: state.volume };
}
