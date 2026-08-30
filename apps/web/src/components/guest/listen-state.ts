export const HOLD_MS = 30_000;

export type ListenIntent = 'idle' | 'playing' | 'holding';

export interface ListenIntentState {
  intent: ListenIntent;
  holdDeadline: number | null;
}

export interface ListenConditions {
  live: boolean;
  closeReason?: 'ended' | 'dropped';
  linkConnected: boolean;
  /** Consumer was open before this producer-close snapshot arrived. */
  wasPlaying: boolean;
  now: number;
}

const IDLE_INTENT: ListenIntentState = { intent: 'idle', holdDeadline: null };
const PLAYING_INTENT: ListenIntentState = { intent: 'playing', holdDeadline: null };

/**
 * Reconciles external facts into playback intent. Hold time is an absolute deadline so a
 * backgrounded phone cannot pause it by throttling timers.
 */
export function reconcileListenIntent(
  state: ListenIntentState,
  conditions: ListenConditions,
): ListenIntentState {
  if (conditions.closeReason === 'ended') {
    return IDLE_INTENT;
  }
  // A dropped link is not a decision to stop listening. The intent outlives it so audio
  // resumes by itself once the socket is back, rather than making the guest press Listen
  // again for a channel that never stopped broadcasting.
  if (!conditions.linkConnected) {
    return state;
  }
  if (conditions.live) {
    return state.intent === 'holding' ? PLAYING_INTENT : state;
  }
  if (state.intent === 'playing' && conditions.wasPlaying && conditions.closeReason === 'dropped') {
    return { intent: 'holding', holdDeadline: conditions.now + HOLD_MS };
  }
  if (
    state.intent === 'holding' &&
    state.holdDeadline !== null &&
    conditions.now < state.holdDeadline
  ) {
    return state;
  }
  return IDLE_INTENT;
}

export type ListenActionState = 'unavailable' | 'ready' | 'playing' | 'holding';

/** Target answers only whether this guest can hear or is hearing this channel. */
export function listenActionState(
  input: ListenIntentState & {
    live: boolean;
    isPlaying: boolean;
    linkConnected: boolean;
    now: number;
  },
): ListenActionState {
  if (!input.linkConnected) {
    return 'unavailable';
  }
  if (input.live) {
    return input.intent !== 'idle' && input.isPlaying ? 'playing' : 'ready';
  }
  if (input.intent === 'holding' && input.holdDeadline !== null && input.now < input.holdDeadline) {
    return 'holding';
  }
  return 'unavailable';
}

export function playTargetLabel(state: ListenActionState): string {
  switch (state) {
    case 'unavailable':
    case 'ready':
      return 'Listen';
    case 'playing':
      return 'Pause';
    case 'holding':
      return 'Holding';
  }
}

export interface ListenBadgeInput {
  /** A Producer exists on this channel. */
  live: boolean;
  /** Socket-authoritative Producer pause; null while an HTTP seed is reconciled. */
  muted: boolean | null;
  /** Unexpected Producer close is inside its bounded recovery window. */
  holding: boolean;
  linkConnected: boolean;
}

type ListenBadgeState = 'offline' | 'on-air' | 'muted' | 'speaker-dropped-off';

/** Broadcast state only. Link is a truth gate: stale broadcast facts never outlive it. */
function listenBadgeState(input: ListenBadgeInput): ListenBadgeState {
  if (!input.linkConnected) {
    return 'offline';
  }
  if (input.live) {
    return input.muted === true ? 'muted' : 'on-air';
  }
  return input.holding ? 'speaker-dropped-off' : 'offline';
}

export function badgeLabel(input: ListenBadgeInput): string {
  switch (listenBadgeState(input)) {
    case 'offline':
      return 'Offline';
    case 'on-air':
      return 'On air';
    case 'muted':
      return 'Muted';
    case 'speaker-dropped-off':
      return 'Speaker dropped off';
  }
}

/** Dot follows Producer ownership, including a paused Producer. */
export function badgeHasLiveDot(input: ListenBadgeInput): boolean {
  const state = listenBadgeState(input);
  return state === 'on-air' || state === 'muted';
}

export interface ListenNoteInput extends ListenBadgeInput {
  /** A resumed Consumer exists, not that the button was tapped. */
  isPlaying: boolean;
  closeReason?: 'ended' | 'dropped';
}

/** Supporting copy without adding a fifth badge state or claiming playback without a Producer. */
export function statusNote(input: ListenNoteInput): string | null {
  if (!input.linkConnected) {
    return 'Nothing to do — this picks itself back up.';
  }
  if (input.holding) {
    return 'Audio resumes by itself if they are straight back.';
  }
  if (!input.live) {
    // Only the drop is worth a line: it explains something the guest just watched stop. A
    // channel that was never on air needs no caption, and printing one moved the screen.
    return input.closeReason === 'dropped'
      ? 'This channel starts on its own as soon as its interpreter is back.'
      : null;
  }
  if (input.muted === true) {
    return 'The interpreter is muted. Audio resumes automatically when they unmute.';
  }
  return input.isPlaying
    ? 'Headphones recommended, so the room stays quiet for everyone else.'
    : null;
}
