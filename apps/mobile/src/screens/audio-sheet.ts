export type OutputOption = {
  id: string;
  label: string;
  selected: boolean;
};

/**
 * Placeholders. React Native cannot enumerate output devices without a native module, and
 * the design's own build notes say iOS should ultimately hand off to the system route picker
 * rather than listing devices itself — that decision belongs to the audio round.
 */
export const DEFAULT_OUTPUTS: OutputOption[] = [
  { id: 'system', label: 'System output', selected: true },
  { id: 'phone', label: 'Phone speaker', selected: false },
  { id: 'headphones', label: 'Headphones', selected: false },
];

export function selectOutput(outputs: OutputOption[], id: string): OutputOption[] {
  return outputs.map((output) => ({ ...output, selected: output.id === id }));
}

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;
export const DEFAULT_VOLUME = 80;

/**
 * Silence has one representation, not two. A mute flag beside a volume lets the two disagree
 * — a slider at zero that the app still calls unmuted — so muting is a move to zero that
 * remembers where it came from, and the speaker control and the slider read the same value.
 */
export type VolumeState = {
  volume: number;
  lastAudible: number;
};

export const DEFAULT_VOLUME_STATE: VolumeState = {
  volume: DEFAULT_VOLUME,
  lastAudible: DEFAULT_VOLUME,
};

const clamp = (value: number) => Math.round(Math.min(Math.max(value, MIN_VOLUME), MAX_VOLUME));

export function setVolume(state: VolumeState, volume: number): VolumeState {
  const next = clamp(volume);

  return { volume: next, lastAudible: next > MIN_VOLUME ? next : state.lastAudible };
}

export function toggleMute(state: VolumeState): VolumeState {
  return isSilent(state)
    ? { volume: state.lastAudible, lastAudible: state.lastAudible }
    : { volume: MIN_VOLUME, lastAudible: state.volume };
}

/** True at zero however it got there: by the control, or by dragging the slider to the end. */
export const isSilent = (state: VolumeState): boolean => state.volume === MIN_VOLUME;

export function volumeLabel(state: VolumeState): string {
  return isSilent(state) ? 'Muted' : `${state.volume}%`;
}

export const AUDIO_SHEET_TITLE = 'Audio';
export const OUTPUT_SECTION_TITLE = 'Output';
export const VOLUME_SECTION_TITLE = 'Volume';
export const MUTE_LABEL = 'Mute';
export const UNMUTE_LABEL = 'Unmute';
export const OUTPUT_NOTE =
  'Switching output drops about a second of audio, so do it between sentences.';
export const AUDIO_SHEET_UNAVAILABLE_NOTE =
  'These controls are not connected to anything in this version.';

export const ALL_AUDIO_SHEET_COPY: string[] = [
  AUDIO_SHEET_TITLE,
  OUTPUT_SECTION_TITLE,
  VOLUME_SECTION_TITLE,
  MUTE_LABEL,
  UNMUTE_LABEL,
  OUTPUT_NOTE,
  AUDIO_SHEET_UNAVAILABLE_NOTE,
  ...DEFAULT_OUTPUTS.map((output) => output.label),
  volumeLabel(DEFAULT_VOLUME_STATE),
  volumeLabel({ volume: 0, lastAudible: 80 }),
];
