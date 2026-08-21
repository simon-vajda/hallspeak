import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioPreferences } from '@/components/speaker/live-state';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  DEFAULT_AUDIO_PREFERENCES,
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

function writeStoredPreferences(preferences: AudioPreferences) {
  try {
    localStorage.setItem(AUDIO_PREFERENCES_STORAGE_KEY, serializePreferences(preferences));
  } catch {
    // Blocked storage: the settings will not survive a reload, but they still apply now.
  }
}

/**
 * Read once, synchronously, so the first render already carries the stored settings and the
 * microphone opens with them rather than audibly re-applying them a moment later.
 *
 * The returned object is a piece of state, so its identity only changes when a preference
 * does — `useMicCapture` re-applies constraints to the live track on that identity, and a
 * fresh object per render would re-apply them continuously mid-broadcast.
 */
export function useAudioPreferences() {
  const [preferences, setPreferencesState] = useState<AudioPreferences>(readStoredPreferences);

  const setPreferences = useCallback((patch: Partial<AudioPreferences>) => {
    setPreferencesState((previous) => {
      const next = { ...previous, ...patch };
      // A patch that settles on the values already held must keep the object it already has:
      // a new identity would re-apply constraints to a live track for no reason.
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
      persisted.current = preferences;
      writeStoredPreferences(preferences);
    }, WRITE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [preferences]);

  // Unmount only, so a change made just before navigating away is not dropped. Cleaning up
  // the effect above would flush on every change instead, which is the debounce undone.
  useEffect(
    () => () => {
      if (pending.current) writeStoredPreferences(latest.current);
    },
    [],
  );

  return { preferences, setPreferences };
}
