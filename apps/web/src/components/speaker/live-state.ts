/**
 * The speaker studio's decisions, kept out of the component so they can be tested without
 * a browser: what the preference toggles become, what the gain slider becomes, and which
 * of the broadcast states the screen is in.
 */

export interface AudioPreferences {
  noiseSuppression: boolean;
  autoGain: boolean;
  echoCancellation: boolean;
  /** 0–100 on the slider, which is not what a GainNode takes. */
  gain: number;
}

/**
 * Applied to the capture track rather than to the producer: the browser's own processing
 * runs before anything is encoded, so turning it off after the fact would achieve nothing.
 * Echo cancellation is offered but defaults off — the interpreter is told to wear headphones,
 * and cancelling against a PA the browser cannot hear does more harm than good. Stated as an
 * explicit `false` rather than omitted, since omission hands the decision back to the browser,
 * which turns it on.
 */
export function trackConstraints(
  preferences: Omit<AudioPreferences, 'gain'>,
): MediaTrackConstraints {
  return {
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGain,
    echoCancellation: preferences.echoCancellation,
  };
}

/** The slider's midpoint is unity, so 0–100 maps onto 0–2 rather than 0–1. */
export const MAX_GAIN = 2;

export function gainNodeValue(sliderValue: number): number {
  const clamped = Math.min(Math.max(sliderValue, 0), 100);
  return (clamped / 100) * MAX_GAIN;
}

/**
 * `live` is derived from a producer existing, never set optimistically on the click: the
 * screen must not say On air before the server has one.
 *
 * `displaced` and `back-from-drop` are separate states rather than shades of muted,
 * because each asks the interpreter for something different — and `back-from-drop` asks
 * for the one action a plain muted screen does not prompt.
 */
export type BroadcastState =
  | 'pre-flight'
  | 'connecting'
  | 'live'
  | 'muted'
  | 'back-from-drop'
  | 'displaced';

export interface BroadcastInput {
  goLivePressed: boolean;
  hasProducer: boolean;
  isMuted: boolean;
  displaced: boolean;
  /** True from an involuntary drop until the interpreter unmutes. */
  recoveredSilently: boolean;
}

export function broadcastState(input: BroadcastInput): BroadcastState {
  // A takeover ends this session outright; nothing below it can apply.
  if (input.displaced) return 'displaced';
  if (!input.goLivePressed) return 'pre-flight';
  if (!input.hasProducer) return 'connecting';
  if (input.recoveredSilently) return 'back-from-drop';
  return input.isMuted ? 'muted' : 'live';
}

/** Only this state has audio reaching anyone; every claim in the copy hangs off it. */
export function isBroadcasting(state: BroadcastState): boolean {
  return state === 'live';
}

/** Why the last broadcast stopped, which is the only thing distinguishing the two. */
export type EndReason = 'deliberate' | 'dropped';

export interface ReconnectInput {
  goLivePressed: boolean;
  lastEnd: EndReason | null;
  displaced: boolean;
}

export type ReconnectAction = { type: 'none' } | { type: 're-produce'; paused: true };

/**
 * After an involuntary drop the client rebuilds and re-produces on its own, paused, so
 * the interpreter's only action is to unmute. After a deliberate end it does nothing —
 * a broadcast somebody chose to stop must not restart itself because the Wi-Fi blinked.
 *
 * A drop must be positively recorded, never inferred from the absence of one. Treating
 * `lastEnd: null` as "not deliberate, so re-produce" fires on the very first Go live —
 * before the producer exists there is nothing to tell the two apart — and the interpreter
 * lands muted on the one path that has to just work.
 */
export function onReconnect(input: ReconnectInput): ReconnectAction {
  if (input.displaced) return { type: 'none' };
  if (!input.goLivePressed) return { type: 'none' };
  if (input.lastEnd !== 'dropped') return { type: 'none' };
  return { type: 're-produce', paused: true };
}

/**
 * The note under the on-air level meter. `muted` and `back-from-drop` explain the silence
 * rather than denying the audience: a listener count sits beside this panel, so copy denying
 * one under a tile reading 3 would be a contradiction. `connecting` states the connection
 * instead of claiming nobody, because a reconnect after a drop reaches it with the previous
 * count still on screen. `pre-flight` and `displaced` never
 * render this panel — the pre-flight screen carries its own note and displaced has no meter.
 */
const ON_AIR_NOTE: Record<BroadcastState, string | undefined> = {
  'pre-flight': undefined,
  connecting: 'Your audio is not on air yet.',
  live: undefined,
  muted: 'You are muted — listeners hear silence.',
  'back-from-drop': 'You are muted — listeners hear silence.',
  displaced: undefined,
};

export function onAirNote(state: BroadcastState): string | undefined {
  return ON_AIR_NOTE[state];
}
