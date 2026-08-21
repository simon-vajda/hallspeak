import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_PREFERENCES,
  parseStoredPreferences,
  serializePreferences,
} from './preferences';

describe('parseStoredPreferences', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(parseStoredPreferences(null)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it('returns the defaults rather than throwing on malformed JSON', () => {
    expect(parseStoredPreferences('{')).toEqual(DEFAULT_AUDIO_PREFERENCES);
    expect(parseStoredPreferences('not json')).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it('returns the defaults for valid JSON that is not an object', () => {
    for (const raw of ['42', '"x"', 'null', '[]']) {
      expect(parseStoredPreferences(raw)).toEqual(DEFAULT_AUDIO_PREFERENCES);
    }
  });

  it('round-trips a complete object unchanged', () => {
    const preferences = {
      noiseSuppression: false,
      autoGain: true,
      echoCancellation: true,
      gain: 40,
    };
    expect(parseStoredPreferences(serializePreferences(preferences))).toEqual(preferences);
  });

  it('takes each absent field from the defaults, so a new preference is compatible both ways', () => {
    expect(parseStoredPreferences('{"gain": 20}')).toEqual({
      ...DEFAULT_AUDIO_PREFERENCES,
      gain: 20,
    });
  });

  it('defaults only the wrong-typed field and keeps its valid siblings', () => {
    expect(parseStoredPreferences('{"noiseSuppression": "yes", "gain": 20}')).toEqual({
      ...DEFAULT_AUDIO_PREFERENCES,
      noiseSuppression: DEFAULT_AUDIO_PREFERENCES.noiseSuppression,
      gain: 20,
    });
  });

  it('clamps a gain from outside the slider’s range', () => {
    expect(parseStoredPreferences('{"gain": -5}').gain).toBe(0);
    expect(parseStoredPreferences('{"gain": 150}').gain).toBe(100);
  });

  it('falls back rather than clamping a gain that is not a finite number', () => {
    for (const raw of ['{"gain": null}', '{"gain": "50"}']) {
      expect(parseStoredPreferences(raw).gain).toBe(DEFAULT_AUDIO_PREFERENCES.gain);
    }
    // NaN and Infinity are not JSON literals; they arrive as the nulls JSON.stringify makes.
    expect(parseStoredPreferences(JSON.stringify({ gain: Number.NaN })).gain).toBe(
      DEFAULT_AUDIO_PREFERENCES.gain,
    );
    expect(parseStoredPreferences(JSON.stringify({ gain: Number.POSITIVE_INFINITY })).gain).toBe(
      DEFAULT_AUDIO_PREFERENCES.gain,
    );
  });

  it('ignores a key it does not know', () => {
    expect(parseStoredPreferences('{"reverb": true, "gain": 20}')).not.toHaveProperty('reverb');
  });
});
