import type { LinkRefusalReason, ListenerDestination } from '@/links/parse';
import { parseListenerLink } from '@/links/parse';

/**
 * `onBarcodeScanned` fires on every frame the code is visible and the camera offers no
 * debounce, so the latch is what makes one code one navigation. It re-arms only on an
 * explicit reset — dismissing the refusal, or leaving and returning to the screen.
 */
export type ScanState = {
  armed: boolean;
  refusal: LinkRefusalReason | null;
};

export const INITIAL_SCAN_STATE: ScanState = { armed: true, refusal: null };

export type ScanOutcome = {
  state: ScanState;
  destination: ListenerDestination | null;
  speakerCode: string | null;
  /** A QR code is read at arm's length with the screen pointed away, so the buzz is often
   * the first confirmation the guest gets. It fires on an accepted code and on no other. */
  haptic: boolean;
};

export function scan(state: ScanState, raw: string): ScanOutcome {
  if (!state.armed) {
    return { state, destination: null, speakerCode: null, haptic: false };
  }

  const parsed = parseListenerLink(raw);

  if (!parsed.ok) {
    return {
      state: { armed: false, refusal: parsed.reason },
      destination: null,
      speakerCode: null,
      haptic: false,
    };
  }

  return {
    state: { armed: false, refusal: null },
    destination: parsed.destination,
    speakerCode: parsed.speakerCode,
    haptic: true,
  };
}

export function rearm(): ScanState {
  return INITIAL_SCAN_STATE;
}

export type CameraPermission = 'undetermined' | 'granted' | 'denied';

/**
 * A camera that has not been asked yet is not a camera that was refused: only the second
 * one can be fixed in system settings, and offering that route to the first would send a
 * guest away from the screen that was about to ask them.
 */
export function cameraPermission(
  status: { granted: boolean; canAskAgain: boolean } | null | undefined,
): CameraPermission {
  if (!status) {
    return 'undetermined';
  }

  if (status.granted) {
    return 'granted';
  }

  return status.canAskAgain ? 'undetermined' : 'denied';
}

export const offersSettings = (permission: CameraPermission): boolean => permission === 'denied';

/** The torch exists for a dim venue, and there is nothing to light until the camera is live. */
export const showsTorch = (permission: CameraPermission): boolean => permission === 'granted';

const REFUSALS: Record<LinkRefusalReason, string> = {
  'not-a-url': "That is not a link. A Hallspeak link starts with 'https://'.",
  'insecure-scheme': 'Hallspeak links are always https.',
  'unknown-host': 'That link does not name a server this app can reach.',
  'wrong-path': 'That is not a Hallspeak event link.',
  'bad-pin': 'An event PIN is six digits.',
  'bad-slug': 'That link names a channel in a form Hallspeak does not use.',
};

/** Names what is wrong with the link. Nothing here needs a server to say it. */
export function refusalMessage(reason: LinkRefusalReason): string {
  return REFUSALS[reason];
}
