import type { ScreenWakeLockStatus } from '@/lib/use-screen-wake-lock';

/**
 * The granted label is a status and the unavailable one is a warning, so neither is the
 * bare instruction: one string doing both jobs cannot be read as either by someone who
 * only ever sees one of them.
 */
export function screenAwakeLabel(status: ScreenWakeLockStatus): string {
  switch (status) {
    case 'held':
      return 'Keeping the screen awake';
    case 'unavailable':
      return 'Screen may dim';
    default:
      return 'Keep the screen awake';
  }
}

export function screenAwakeNote(status: ScreenWakeLockStatus): string | null {
  switch (status) {
    case 'held':
      return 'This browser is holding the screen on for you, so it will not dim on its own.';
    case 'unavailable':
      return 'This browser cannot hold the screen on, so give the phone a longer screen timeout before you start.';
    default:
      return null;
  }
}
