import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioPreferences } from '@/components/speaker/live-state';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  mergeStoredPreferences,
  parseStoredPreferences,
  samePreferences,
  serializePreferences,
} from './preferences';

// The gain slider reports every pointer move, and `setItem` is a synchronous call that can
// reach the disk. A trailing debounce keeps that out of the drag path without the slider
// having to grow a commit callback.
const WRITE_DEBOUNCE_MS = 300;

// Storage access throws rather than returning null where cookies are blocked, and this read
// runs in a useState initializer where an uncaught throw blanks the screen.
function readStoredPreferences(): AudioPreferences {
  try {
    return parseStoredPreferences(localStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

// Re-read inside the write so a second tab's edits to other fields survive this one's. The
// read costs a parse, which the debounce already keeps off the drag path.
function writeStoredPreferences(next: AudioPreferences, baseline: AudioPreferences) {
  try {
    const stored = parseStoredPreferences(localStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY));
    localStorage.setItem(
      AUDIO_PREFERENCES_STORAGE_KEY,
      serializePreferences(mergeStoredPreferences(stored, baseline, next)),
    );
  } catch {
    // Blocked storage: the settings will not survive a reload, but they still apply now.
  }
}

/**
 * Read once, synchronously, so the first render already carries the stored settings and the
 * microphone opens with them rather than audibly re-applying them a moment later.
 */
export function useAudioPreferences() {
  const [preferences, setPreferencesState] = useState<AudioPreferences>(readStoredPreferences);

  const setPreferences = useCallback((patch: Partial<AudioPreferences>) => {
    setPreferencesState((previous) => {
      const next = { ...previous, ...patch };
      return samePreferences(next, previous) ? previous : next;
    });
  }, []);

  const latest = useRef(preferences);
  latest.current = preferences;
  // What storage is known to hold, so the write is skipped by comparing values rather than by
  // counting renders — an effect that mounts twice in development must not write either.
  const persisted = useRef(preferences);
  const pending = useRef(false);

  useEffect(() => {
    if (samePreferences(preferences, persisted.current)) {
      pending.current = false;
      return;
    }

    pending.current = true;
    const timer = setTimeout(() => {
      pending.current = false;
      writeStoredPreferences(preferences, persisted.current);
      persisted.current = preferences;
    }, WRITE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [preferences]);

  // Cleaning up the effect above would flush on every change instead, which is the debounce
  // undone — so the pending write is flushed here, once, on the two ways the studio ends.
  // Leaving the page runs no cleanup at all, and `pagehide` is what fires there where
  // `beforeunload` does not on iOS Safari.
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      pending.current = false;
      writeStoredPreferences(latest.current, persisted.current);
      persisted.current = latest.current;
    };

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { preferences, setPreferences };
}
