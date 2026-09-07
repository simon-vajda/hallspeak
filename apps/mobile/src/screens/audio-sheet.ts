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

/** Muted is its own reading, not zero per cent: the two mean different things to a listener. */
export function volumeLabel(volume: number, muted: boolean): string {
  if (muted) {
    return 'Muted';
  }

  const clamped = Math.round(Math.min(Math.max(volume, MIN_VOLUME), MAX_VOLUME));

  return `${clamped}%`;
}

export const AUDIO_SHEET_TITLE = 'Audio';
export const OUTPUT_SECTION_TITLE = 'Output';
export const VOLUME_SECTION_TITLE = 'Volume';
export const MUTE_LABEL = 'Mute';
export const OUTPUT_NOTE =
  'Switching output drops about a second of audio, so do it between sentences.';
export const AUDIO_SHEET_UNAVAILABLE_NOTE =
  'These controls are not connected to anything in this version.';

export const ALL_AUDIO_SHEET_COPY: string[] = [
  AUDIO_SHEET_TITLE,
  OUTPUT_SECTION_TITLE,
  VOLUME_SECTION_TITLE,
  MUTE_LABEL,
  OUTPUT_NOTE,
  AUDIO_SHEET_UNAVAILABLE_NOTE,
  ...DEFAULT_OUTPUTS.map((output) => output.label),
  volumeLabel(DEFAULT_VOLUME, false),
  volumeLabel(0, true),
];
