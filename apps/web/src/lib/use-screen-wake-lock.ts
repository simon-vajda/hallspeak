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
    let pending = false;
    let sentinel: WakeLockSentinel | null = null;

    const request = async () => {
      // `pending` is what keeps a visibility change from starting a second request while
      // the first is still awaiting: `sentinel` is null for that whole window, so it
      // cannot hold the lock alone. A sentinel the browser already released is not one.
      const held = sentinel !== null && !sentinel.released;
      if (released || pending || held || document.visibilityState !== 'visible') {
        return;
      }
      pending = true;
      try {
        const next = await api.request('screen');
        if (released) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch {
        // Refused or unavailable; the screen keeps its own timeout.
      } finally {
        pending = false;
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
