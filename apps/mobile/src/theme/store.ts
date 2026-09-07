import Storage from 'expo-sqlite/kv-store';
import { parseThemePreference, THEME_STORAGE_KEY, type ThemePreference } from './preferences';

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(Storage.getItemSync(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function saveThemePreference(preference: ThemePreference): boolean {
  try {
    Storage.setItemSync(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}
