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
      return 'This browser is keeping the screen on, so the phone will not dim it on its own.';
    case 'unavailable':
      return 'This browser cannot keep the screen on. Give the phone a longer screen timeout before you start.';
    default:
      return null;
  }
}

export const SCREEN_AWAKE_WARNING =
  'A phone takes the microphone away as soon as the browser goes to the background or the screen locks. Leave this page in the foreground and the phone unlocked for the whole broadcast.';
