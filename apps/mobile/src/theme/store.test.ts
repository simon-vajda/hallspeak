import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import Storage from 'expo-sqlite/kv-store';
import { THEME_STORAGE_KEY } from './preferences';
import { readThemePreference, saveThemePreference } from './store';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: jest.fn(), setItemSync: jest.fn() },
}));

const getItem = jest.mocked(Storage.getItemSync);
const setItem = jest.mocked(Storage.setItemSync);

beforeEach(() => {
  getItem.mockReset();
  setItem.mockReset();
});

describe('appearance storage', () => {
  it('round-trips all choices without touching event history', () => {
    const values = new Map([['hallspeak-history', 'untouched']]);
    getItem.mockImplementation((key) => values.get(key) ?? null);
    setItem.mockImplementation((key, value) => {
      values.set(key, typeof value === 'function' ? value(values.get(key) ?? null) : value);
    });

    for (const preference of ['dark', 'light', 'system'] as const) {
      expect(saveThemePreference(preference)).toBe(true);
      expect(readThemePreference()).toBe(preference);
    }
    expect(values.size).toBe(2);
    expect(values.get('hallspeak-history')).toBe('untouched');
    expect(values.get(THEME_STORAGE_KEY)).toBe('system');
  });

  it('starts in System when storage cannot be read', () => {
    getItem.mockImplementation(() => {
      throw new Error('Read failed');
    });
    expect(readThemePreference()).toBe('system');
  });

  it('reports failed saves and allows a later retry', () => {
    setItem.mockImplementationOnce(() => {
      throw new Error('Write failed');
    });
    expect(saveThemePreference('dark')).toBe(false);
    expect(saveThemePreference('dark')).toBe(true);
  });
});
