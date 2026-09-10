import { useEffect } from 'react';

/**
 * Holds a screen wake lock for the calling component's lifetime. Every call is best
 * effort: an unsupported API or a refused request leaves the screen behaving normally
 * and surfaces nothing. A browser drops the lock whenever the document is hidden, so a
 * fresh one is taken each time it becomes visible again.
 */
export function useScreenWakeLock(): void {
  useEffect(() => {
    const api = navigator.wakeLock;
    if (!api) {
      return;
    }

    let released = false;
    let sentinel: WakeLockSentinel | null = null;

    const request = async () => {
      if (released || sentinel || document.visibilityState !== 'visible') {
        return;
      }
      try {
        const next = await api.request('screen');
        if (released) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
        next.addEventListener('release', () => {
          if (sentinel === next) {
            sentinel = null;
          }
        });
      } catch {
        // Refused or unavailable; the screen keeps its own timeout.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void request();
      }
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);
}
