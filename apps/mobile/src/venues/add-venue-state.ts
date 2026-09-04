import { parseListenerLink } from './link';
import type { EventLookup, LinkRefusalReason, Venue } from './types';

export type CameraPermission = 'undetermined' | 'granted' | 'denied';

export type AddVenueState = {
  permission: CameraPermission;
  linkEntryOpen: boolean;
  /** The venue whose lookup is in flight; null whenever nothing is being checked. */
  pending: Venue | null;
  error: string | null;
  /** Set once a lookup verified, which is the screen's cue to hand over to the event. */
  opened: Venue | null;
};

export const INITIAL_ADD_VENUE_STATE: AddVenueState = {
  permission: 'undetermined',
  linkEntryOpen: false,
  pending: null,
  error: null,
  opened: null,
};

export const CAMERA_DENIED_NOTICE =
  'LinguaCast cannot use the camera. Allow it in your phone settings, or enter the link instead.';

/**
 * A removed event, a disabled one and a code that never existed are one outcome, matching the
 * server's 404 parity: the message may not let a guesser tell them apart.
 */
export const NOT_FOUND_MESSAGE =
  'No event answered that code. It may have finished, or its code may have changed.';

/**
 * Names no cause. An untrusted certificate and a host that is simply not there are reported
 * identically by the platform, so any explanation here would be a guess.
 */
export const UNREACHABLE_MESSAGE = 'That venue did not answer. Try again in a moment.';

const REFUSALS: Record<LinkRefusalReason, string> = {
  empty: 'Paste or type the link from your venue.',
  not_a_link: 'That does not look like a link.',
  insecure_scheme: 'Only https links can be opened.',
  missing_pin: 'That link carries no event code.',
  invalid_pin: 'The event code in that link is not valid.',
};

export function linkRefusalMessage(reason: LinkRefusalReason): string {
  return REFUSALS[reason];
}

export type AddVenueAction =
  | { kind: 'permission'; permission: CameraPermission }
  | { kind: 'open-link-entry' }
  | { kind: 'close-link-entry' }
  | { kind: 'submit'; input: string }
  | { kind: 'resolved'; lookup: EventLookup };

function lookupMessage(lookup: EventLookup): string | null {
  switch (lookup.outcome) {
    case 'verified':
      return null;
    case 'not_found':
      return NOT_FOUND_MESSAGE;
    case 'unreachable':
      return UNREACHABLE_MESSAGE;
  }
}

/**
 * The whole scanner and link-entry decision, kept out of the screen so the guard against a
 * second lookup cannot be undone by a re-render: a camera reports the same code many times a
 * second, and every one of those arrives as a submission.
 */
export function addVenueReducer(state: AddVenueState, action: AddVenueAction): AddVenueState {
  switch (action.kind) {
    case 'permission':
      return state.permission === action.permission
        ? state
        : { ...state, permission: action.permission };

    case 'open-link-entry':
      return { ...state, linkEntryOpen: true, error: null };

    case 'close-link-entry':
      return { ...state, linkEntryOpen: false };

    case 'submit': {
      if (state.pending !== null || state.opened !== null) {
        return state;
      }
      const parsed = parseListenerLink(action.input);
      if (!parsed.ok) {
        return { ...state, error: linkRefusalMessage(parsed.reason) };
      }
      return { ...state, pending: parsed.venue, error: null };
    }

    case 'resolved': {
      const pending = state.pending;
      if (pending === null) {
        return state;
      }
      if (action.lookup.outcome === 'verified') {
        return { ...state, pending: null, error: null, linkEntryOpen: false, opened: pending };
      }
      return { ...state, pending: null, error: lookupMessage(action.lookup) };
    }
  }
}

export type CameraField = 'pending' | 'active' | 'blocked';

export type AddVenueView = {
  camera: CameraField;
  cameraNotice: string | null;
  linkEntryOpen: boolean;
  /** Never withdrawn by a refused camera: the link is what keeps that listener moving. */
  linkEntryEnabled: boolean;
  scanEnabled: boolean;
  busy: boolean;
  error: string | null;
  openEvent: Venue | null;
};

function cameraField(permission: CameraPermission): CameraField {
  switch (permission) {
    case 'undetermined':
      return 'pending';
    case 'granted':
      return 'active';
    case 'denied':
      return 'blocked';
  }
}

export function addVenueView(state: AddVenueState): AddVenueView {
  const settled = state.pending === null && state.opened === null;

  return {
    camera: cameraField(state.permission),
    cameraNotice: state.permission === 'denied' ? CAMERA_DENIED_NOTICE : null,
    linkEntryOpen: state.linkEntryOpen,
    linkEntryEnabled: state.opened === null,
    scanEnabled: state.permission === 'granted' && settled,
    busy: state.pending !== null,
    error: state.error,
    openEvent: state.opened,
  };
}
