/**
 * The speaker studio's decisions, kept out of the component so they can be tested without
 * a browser: what the preference toggles become, what the gain slider becomes, and which
 * of the broadcast states the screen is in.
 */

export interface AudioPreferences {
  noiseSuppression: boolean;
  autoGain: boolean;
  echoCancellation: boolean;
  /** 0–200 on the slider, which is not what a GainNode takes. */
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

/** Fifty slider points remain 1x, so existing stored values keep their current loudness. */
export const MAX_GAIN_SLIDER_VALUE = 200;
export const MAX_GAIN_NODE_VALUE = 4;

export function gainNodeValue(sliderValue: number): number {
  const clamped = Math.min(Math.max(sliderValue, 0), MAX_GAIN_SLIDER_VALUE);
  return (clamped / MAX_GAIN_SLIDER_VALUE) * MAX_GAIN_NODE_VALUE;
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
  if (input.displaced) {
    return 'displaced';
  }
  if (!input.goLivePressed) {
    return 'pre-flight';
  }
  if (!input.hasProducer) {
    return 'connecting';
  }
  if (input.recoveredSilently) {
    return 'back-from-drop';
  }
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
  if (input.displaced) {
    return { type: 'none' };
  }
  if (!input.goLivePressed) {
    return { type: 'none' };
  }
  if (input.lastEnd !== 'dropped') {
    return { type: 'none' };
  }
  return { type: 're-produce', paused: true };
}
