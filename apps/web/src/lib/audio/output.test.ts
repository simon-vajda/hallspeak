import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioDevice } from './devices';
import {
  hasNamedOutputs,
  parseStoredOutput,
  resolveOutputSelection,
  serializeOutput,
  supportsAudioOutputSelection,
} from './output';

const outputs: AudioDevice[] = [
  { deviceId: 'headphones', groupId: 'headphones-group', label: 'Headphones' },
  { deviceId: 'speakers', groupId: 'speakers-group', label: 'Built-in Speakers' },
];

describe('stored output', () => {
  it('round trips a non-empty device id', () => {
    expect(parseStoredOutput(serializeOutput('headphones'))).toBe('headphones');
  });

  it.each([null, '', 'not json', '""', '3', 'false', '{}', '[]'])(
    'treats %j as no selection',
    (raw) => {
      expect(parseStoredOutput(raw)).toBeNull();
    },
  );
});

describe('output capability', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false outside a browser', () => {
    expect(supportsAudioOutputSelection()).toBe(false);
  });

  it('detects setSinkId on the media-element prototype', () => {
    vi.stubGlobal(
      'HTMLMediaElement',
      class {
        setSinkId() {}
      },
    );

    expect(supportsAudioOutputSelection()).toBe(true);
  });

  it('requires at least one real device id for a named list', () => {
    expect(hasNamedOutputs([])).toBe(false);
    expect(hasNamedOutputs([{ deviceId: '', groupId: '', label: 'Audio output 1' }])).toBe(false);
    expect(hasNamedOutputs(outputs.slice(0, 1))).toBe(true);
  });
});

describe('resolveOutputSelection', () => {
  it('keeps a stored device that is present', () => {
    expect(resolveOutputSelection(outputs, 'headphones')).toBe('headphones');
  });

  it('uses no explicit selection when the stored device is absent', () => {
    expect(resolveOutputSelection(outputs, 'gone')).toBeNull();
    expect(resolveOutputSelection(outputs, null)).toBeNull();
  });
});
