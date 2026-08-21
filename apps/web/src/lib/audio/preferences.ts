import type { AudioPreferences } from '@/components/speaker/live-state';

/**
 * The pure half of preference persistence, split from the hook so the cases a developer
 * never sees on their own machine — a half-written object, a value edited by hand, a key
 * left behind by an older build — are testable without a DOM or a stubbed storage.
 */

/** One key, mirroring `linguacast-theme`; four keys would make a partial write possible. */
export const AUDIO_PREFERENCES_STORAGE_KEY = 'linguacast-audio-preferences';

/**
 * The one authoritative fallback: a browser with blocked storage and a browser with nothing
 * stored must agree. Echo cancellation is off because the interpreter wears headphones —
 * see `trackConstraints`.
 */
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  noiseSuppression: true,
  autoGain: false,
  echoCancellation: false,
  gain: 68,
};

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function gain(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 100);
}

/**
 * Total by design: every field falls back on its own, so a stored object missing one — or
 * carrying one this build does not know — still yields a usable set rather than the defaults
 * wholesale. That per-field tolerance is what makes a version marker unnecessary.
 */
export function parseStoredPreferences(raw: string | null): AudioPreferences {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_AUDIO_PREFERENCES;
  }

  const stored = parsed as Record<string, unknown>;
  return {
    noiseSuppression: boolean(stored.noiseSuppression, DEFAULT_AUDIO_PREFERENCES.noiseSuppression),
    autoGain: boolean(stored.autoGain, DEFAULT_AUDIO_PREFERENCES.autoGain),
    echoCancellation: boolean(stored.echoCancellation, DEFAULT_AUDIO_PREFERENCES.echoCancellation),
    gain: gain(stored.gain, DEFAULT_AUDIO_PREFERENCES.gain),
  };
}

export function serializePreferences(preferences: AudioPreferences): string {
  return JSON.stringify(preferences);
}
