import Storage from 'expo-sqlite/kv-store';
import {
  HISTORY_STORAGE_KEY,
  type HistoryEntry,
  type HistoryKey,
  markUnavailable,
  parseHistory,
  type RememberInput,
  remember,
  remove,
  restore,
  serializeHistory,
  setPinned,
} from './history';

/**
 * `expo-sqlite/kv-store` rather than `expo-secure-store`, which the design's build notes
 * name: that is a Keychain/Keystore API for tokens, refuses values much over 2 KB, and would
 * truncate a growing list. This one is AsyncStorage-compatible and reads synchronously, so
 * pinned rows paint on the first frame instead of after an empty flash.
 */
export function listHistorySync(): HistoryEntry[] {
  try {
    return parseHistory(Storage.getItemSync(HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): HistoryEntry[] {
  Storage.setItemSync(HISTORY_STORAGE_KEY, serializeHistory(entries));
  return entries;
}

export function rememberEvent(input: RememberInput): HistoryEntry[] {
  return write(remember(listHistorySync(), input));
}

export function markEventUnavailable(key: HistoryKey): HistoryEntry[] {
  return write(markUnavailable(listHistorySync(), key));
}

export function setEventPinned(key: HistoryKey, pinned: boolean): HistoryEntry[] {
  return write(setPinned(listHistorySync(), key, pinned));
}

export function restoreEvent(entry: HistoryEntry): HistoryEntry[] {
  return write(restore(listHistorySync(), entry));
}

export function removeEvent(key: HistoryKey): HistoryEntry[] {
  return write(remove(listHistorySync(), key));
}
