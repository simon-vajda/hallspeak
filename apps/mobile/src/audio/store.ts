import Storage from 'expo-sqlite/kv-store';
import {
  DEFAULT_VOLUME_STATE,
  parseStoredVolume,
  serializeVolume,
  type VolumeState,
} from './volume';

/** Read synchronously, so the slider paints at the guest's own level on the first frame. */
export function readVolume(): VolumeState {
  try {
    return parseStoredVolume(Storage.getItemSync(VOLUME_KEY));
  } catch {
    return DEFAULT_VOLUME_STATE;
  }
}

export function saveVolume(state: VolumeState): boolean {
  try {
    Storage.setItemSync(VOLUME_KEY, serializeVolume(state));
    return true;
  } catch {
    return false;
  }
}

const VOLUME_KEY = 'linguacast-audio-volume';
