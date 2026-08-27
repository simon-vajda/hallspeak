import { describe, expect, it } from 'vitest';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  type AudioPreferences,
  DEFAULT_AUDIO_PREFERENCES,
  gainNodeValue,
  MAX_GAIN_NODE_VALUE,
  MAX_GAIN_SLIDER_VALUE,
  mergeStoredPreferences,
  parseStoredPreferences,
  samePreferences,
  serializePreferences,
  trackConstraints,
} from './preferences';

describe('trackConstraints', () => {
  it('maps each toggle onto the constraint it controls', () => {
    expect(
      trackConstraints({
        noiseSuppression: true,
        autoGain: false,
        echoCancellation: true,
      }),
    ).toEqual({
      noiseSuppression: true,
      autoGainControl: false,
      echoCancellation: true,
    });
    expect(
      trackConstraints({
        noiseSuppression: false,
        autoGain: true,
        echoCancellation: false,
      }),
    ).toEqual({
      noiseSuppression: false,
      autoGainControl: true,
      echoCancellation: false,
    });
  });

  it('states echo cancellation off rather than omitting it, which would hand the browser the choice', () => {
    expect(
      trackConstraints({
        noiseSuppression: true,
        autoGain: false,
        echoCancellation: false,
      }),
    ).toHaveProperty('echoCancellation', false);
  });

  it('carries no gain: that is a node on the graph, not a track constraint', () => {
    const preferences: AudioPreferences = {
      noiseSuppression: true,
      autoGain: true,
      echoCancellation: false,
      gain: 90,
    };
    expect(trackConstraints(preferences)).not.toHaveProperty('gain');
  });
});

describe('gainNodeValue', () => {
  it('keeps 50 slider points equal to 1x across the expanded range', () => {
    expect([
      gainNodeValue(0),
      gainNodeValue(50),
      gainNodeValue(100),
      gainNodeValue(MAX_GAIN_SLIDER_VALUE),
    ]).toEqual([0, 1, 2, MAX_GAIN_NODE_VALUE]);
  });

  it('clamps a value from outside the slider’s range', () => {
    expect(gainNodeValue(-20)).toBe(0);
    expect(gainNodeValue(MAX_GAIN_SLIDER_VALUE + 20)).toBe(MAX_GAIN_NODE_VALUE);
  });
});

describe('parseStoredPreferences', () => {
  it('keeps the browser-global storage key stable', () => {
    expect(AUDIO_PREFERENCES_STORAGE_KEY).toBe('linguacast-audio-preferences');
  });

  it('keeps the established manual gain default', () => {
    expect(DEFAULT_AUDIO_PREFERENCES.gain).toBe(68);
  });

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
      gain: 180,
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

  it('keeps existing gain meaning while accepting the expanded range', () => {
    expect(parseStoredPreferences('{"gain": 100}').gain).toBe(100);
    expect(parseStoredPreferences('{"gain": 150}').gain).toBe(150);
    expect(parseStoredPreferences('{"gain": 200}').gain).toBe(200);
  });

  it('clamps a gain from above the expanded slider range', () => {
    expect(parseStoredPreferences('{"gain": 250}').gain).toBe(200);
  });

  it('refuses to restore a silent gain, which is what a reload is trying to escape', () => {
    for (const raw of ['{"gain": 0}', '{"gain": 4}', '{"gain": -5}']) {
      expect(parseStoredPreferences(raw).gain).toBe(DEFAULT_AUDIO_PREFERENCES.gain);
    }
    expect(parseStoredPreferences('{"gain": 5}').gain).toBe(5);
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

describe('samePreferences', () => {
  it('holds for equal values held in different objects', () => {
    expect(samePreferences(DEFAULT_AUDIO_PREFERENCES, { ...DEFAULT_AUDIO_PREFERENCES })).toBe(true);
  });

  it('fails on any one field, so no change can be mistaken for none', () => {
    for (const patch of [
      { noiseSuppression: !DEFAULT_AUDIO_PREFERENCES.noiseSuppression },
      { autoGain: !DEFAULT_AUDIO_PREFERENCES.autoGain },
      { echoCancellation: !DEFAULT_AUDIO_PREFERENCES.echoCancellation },
      { gain: DEFAULT_AUDIO_PREFERENCES.gain + 1 },
    ]) {
      expect(
        samePreferences(DEFAULT_AUDIO_PREFERENCES, { ...DEFAULT_AUDIO_PREFERENCES, ...patch }),
      ).toBe(false);
    }
  });
});

describe('mergeStoredPreferences', () => {
  const baseline = DEFAULT_AUDIO_PREFERENCES;

  it('keeps a field this tab did not touch at whatever another tab stored', () => {
    const stored = { ...baseline, gain: 40 };
    const next = { ...baseline, noiseSuppression: !baseline.noiseSuppression };

    const merged = mergeStoredPreferences(stored, baseline, next);
    expect(merged.gain).toBe(40);
    expect(merged.noiseSuppression).toBe(next.noiseSuppression);
  });

  it('writes a field this tab did change even when another tab stored something else', () => {
    const stored = { ...baseline, gain: 40 };
    const next = { ...baseline, gain: 180 };

    expect(mergeStoredPreferences(stored, baseline, next).gain).toBe(180);
  });

  it('preserves an extended stored gain while merging an unrelated field', () => {
    const stored = { ...baseline, gain: 180 };
    const next = { ...baseline, echoCancellation: !baseline.echoCancellation };

    expect(mergeStoredPreferences(stored, baseline, next)).toEqual({
      ...stored,
      echoCancellation: next.echoCancellation,
    });
  });

  it('is the stored object when this tab changed nothing', () => {
    const stored = { ...baseline, gain: 40, autoGain: !baseline.autoGain };

    expect(mergeStoredPreferences(stored, baseline, baseline)).toEqual(stored);
  });
});
