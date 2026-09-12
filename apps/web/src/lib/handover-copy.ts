import type { PreflightAction } from '@/components/speaker/speaker-studio-state';

/**
 * Every string the negotiated handover can render, in one module so a test can enumerate
 * them and hold them to the studio's rule about claiming an audience.
 */

/**
 * Short enough to sit beside the header's other controls at 320px: the badge's live dot and
 * tint already carry the state, and the note under the action says the sentence in full.
 */
export const ANOTHER_INTERPRETER = 'Another interpreter';

/**
 * `unknown` is the screen withholding, so its label states that rather than reporting an
 * idle channel: an interpreter told the channel is off air would go live over a colleague.
 */
export function preflightBadgeLabel(action: PreflightAction['type']): string {
  switch (action) {
    case 'go-live':
      return 'Off air';
    case 'unknown':
      return 'Channel status unknown';
    default:
      return ANOTHER_INTERPRETER;
  }
}

/** Whether the badge is reporting a colleague's live channel rather than this studio's. */
export function otherInterpreterLive(action: PreflightAction['type']): boolean {
  return action !== 'go-live' && action !== 'unknown';
}

/**
 * Short: every one of these sits inside the same full-width pill, which does not wrap, and
 * the note above the pill is where the sentence goes.
 */
export function preflightActionLabel(action: PreflightAction['type']): string {
  switch (action) {
    case 'go-live':
      return 'Go live';
    case 'ready':
      return 'Ready to go live';
    case 'waiting':
      return 'Waiting for an answer';
    case 'take-over':
      return 'Take over now';
    case 'pending-elsewhere':
      return 'Handing over…';
    case 'unknown':
      return 'Checking…';
  }
}

export function preflightNote(action: PreflightAction['type']): string | null {
  switch (action) {
    case 'ready':
      return 'Another interpreter has this channel. Ask them to hand it over — they can do that straight away, and if they do not answer you can take it over after 30 seconds.';
    case 'waiting':
      return 'The other interpreter has been asked to hand over. You can take the channel yourself once the countdown ends.';
    case 'take-over':
      return 'No answer from the other interpreter. Taking over puts you on air in their place.';
    case 'pending-elsewhere':
      return 'This channel is already being handed to another interpreter. Wait for that to finish, then ask again.';
    case 'unknown':
      return 'Checking who holds this channel.';
    default:
      return null;
  }
}

export const CANCEL_REQUEST = 'Cancel the request';

export const HANDOVER_REQUEST_TITLE = 'Another interpreter is ready to take this channel';

/**
 * The waiting studio's right to force the swap is the server's answer; on this side the
 * deadline only chooses a sentence, so reading it off the countdown is safe here.
 */
export function handoverRequestNote(deadlinePassed: boolean): string {
  return deadlinePassed
    ? 'They can take the channel over now. Hand over when you reach a natural break.'
    : 'Hand over when you reach a natural break. If you do not, they can take the channel when the countdown ends.';
}

export const HAND_OVER = 'Hand over';

export const HANDING_OVER_TITLE = 'Handing the channel over';

export const HANDING_OVER_NOTE =
  'Keep going until the other interpreter is ready — your microphone stays open until the swap finishes.';

export const END_WITH_HANDOVER =
  'Another interpreter is waiting, so ending here hands them the channel instead of taking it off air.';

export const HANDOVER_FAILED =
  'That did not go through. The channel may have moved on — try again.';

/**
 * `m:ss`, rounded up to the whole second: any time left at all has to read as a second
 * remaining, or the last tick would show zero while the deadline is still in force.
 */
export function formatCountdown(remainingMs: number): string {
  const total = Math.ceil(Math.max(0, remainingMs) / 1_000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
