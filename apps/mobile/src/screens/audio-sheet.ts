import { OUTPUT_UNKNOWN_LABEL, outputLabel } from '@/audio/output';
import { DEFAULT_VOLUME_STATE, volumeLabel } from '@/audio/volume';

export const AUDIO_SHEET_TITLE = 'Audio';
export const OUTPUT_SECTION_TITLE = 'Output';
export const VOLUME_SECTION_TITLE = 'Volume';
export const MUTE_LABEL = 'Mute';
export const UNMUTE_LABEL = 'Unmute';

/** The row's own action, which opens the platform's chooser rather than a list of ours. */
export const CHANGE_OUTPUT_LABEL = 'Change output';

/**
 * Neither platform offers an app a general enumerable list of outputs, so the sheet names
 * where the audio is going and hands the choosing to the system's own picker.
 */
export const OUTPUT_NOTE = 'Choosing an output opens your phone\u2019s own audio chooser.';

export const ALL_AUDIO_SHEET_COPY: string[] = [
  AUDIO_SHEET_TITLE,
  OUTPUT_SECTION_TITLE,
  VOLUME_SECTION_TITLE,
  MUTE_LABEL,
  UNMUTE_LABEL,
  CHANGE_OUTPUT_LABEL,
  OUTPUT_NOTE,
  OUTPUT_UNKNOWN_LABEL,
  outputLabel('AirPods Pro'),
  volumeLabel(DEFAULT_VOLUME_STATE),
  volumeLabel({ volume: 0, lastAudible: 70 }),
];
