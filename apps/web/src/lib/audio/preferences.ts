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

/**
 * A stored gain below this is indistinguishable from a broken microphone, and reloading is
 * exactly how an interpreter tries to recover from one — restoring the silence they reloaded
 * to escape. Zero stays reachable on the slider; it is only never restored into.
 */
const MIN_RESTORED_GAIN = 5;

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function gain(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(Math.max(value, 0), 100);
  return clamped < MIN_RESTORED_GAIN ? fallback : clamped;
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

/**
 * What this tab should write: its own edits over whatever is in storage now, field by field.
 *
 * Two studio tabs each hold a whole preference object, so writing that object wholesale lets
 * the second tab revert a field it never touched — its snapshot of that field is simply older.
 * `baseline` is what this tab last read or wrote, so a field equal to it was not edited here
 * and keeps the stored value. Deliberately not a live sync: a tab still never adopts another
 * tab's change while it is open, because doing so would re-apply constraints mid-broadcast.
 */
export function mergeStoredPreferences(
  stored: AudioPreferences,
  baseline: AudioPreferences,
  next: AudioPreferences,
): AudioPreferences {
  return {
    noiseSuppression:
      next.noiseSuppression === baseline.noiseSuppression
        ? stored.noiseSuppression
        : next.noiseSuppression,
    autoGain: next.autoGain === baseline.autoGain ? stored.autoGain : next.autoGain,
    echoCancellation:
      next.echoCancellation === baseline.echoCancellation
        ? stored.echoCancellation
        : next.echoCancellation,
    gain: next.gain === baseline.gain ? stored.gain : next.gain,
  };
}

/**
 * Compared by value so a patch that settles on the values already held can keep the object
 * it already has, and a write that changes nothing costs no render.
 */
export function samePreferences(a: AudioPreferences, b: AudioPreferences): boolean {
  return (
    a.noiseSuppression === b.noiseSuppression &&
    a.autoGain === b.autoGain &&
    a.echoCancellation === b.echoCancellation &&
    a.gain === b.gain
  );
}
