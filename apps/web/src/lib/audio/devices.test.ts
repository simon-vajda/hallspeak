import { describe, expect, it } from 'vitest';
import { type DeviceInfoLike, resolveSelection, shapeDevices } from './devices';

function device(partial: Partial<DeviceInfoLike>): DeviceInfoLike {
  return { deviceId: 'id', kind: 'audioinput', label: '', groupId: 'group', ...partial };
}

describe('shapeDevices', () => {
  // Labels are empty until getUserMedia has been granted once, so the picker must name them.
  it('names unlabelled devices sequentially in list order', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'a', groupId: 'ga' }),
        device({ deviceId: 'b', groupId: 'gb' }),
        device({ deviceId: 'c', groupId: 'gc' }),
      ],
      'audioinput',
    );

    expect(shaped.map((d) => d.label)).toEqual(['Microphone 1', 'Microphone 2', 'Microphone 3']);
    expect(shaped.map((d) => d.deviceId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps real labels once permission has been granted', () => {
    const shaped = shapeDevices(
      [device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' })],
      'audioinput',
    );
    expect(shaped).toEqual([
      { deviceId: 'a', groupId: 'ga', isDefault: false, label: 'Yeti Nano' },
    ]);
  });

  it('collapses the default alias into the real device it points at', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'default', groupId: 'ga', label: 'Default - Yeti Nano' }),
        device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
        device({ deviceId: 'b', groupId: 'gb', label: 'Built-in Microphone' }),
      ],
      'audioinput',
    );

    expect(shaped).toEqual([
      { deviceId: 'a', groupId: 'ga', isDefault: true, label: 'Yeti Nano' },
      { deviceId: 'b', groupId: 'gb', isDefault: false, label: 'Built-in Microphone' },
    ]);
  });

  it('keeps the default alias first, where the browser put it', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'default', groupId: 'gb', label: 'Default - Built-in Microphone' }),
        device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
        device({ deviceId: 'b', groupId: 'gb', label: 'Built-in Microphone' }),
      ],
      'audioinput',
    );

    expect(shaped.map((d) => d.deviceId)).toEqual(['b', 'a']);
  });

  it('collapses the communications alias too', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'communications', groupId: 'ga', label: 'Communications - Yeti Nano' }),
        device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
      ],
      'audioinput',
    );

    expect(shaped).toEqual([
      { deviceId: 'a', groupId: 'ga', isDefault: false, label: 'Yeti Nano' },
    ]);
  });

  it('drops outputs and anything that is not an audio input', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
        device({ deviceId: 'o', groupId: 'go', kind: 'audiooutput', label: 'Speakers' }),
        device({ deviceId: 'v', groupId: 'gv', kind: 'videoinput', label: 'FaceTime HD' }),
      ],
      'audioinput',
    );

    expect(shaped.map((d) => d.deviceId)).toEqual(['a']);
  });

  it('returns an empty list when there are no inputs at all', () => {
    expect(shapeDevices([], 'audioinput')).toEqual([]);
    expect(shapeDevices([device({ kind: 'audiooutput' })], 'audioinput')).toEqual([]);
  });

  // Firefox reports an empty groupId for some devices, which grouping blindly would fold into one.
  it('does not collapse distinct devices that share an empty groupId', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'a', groupId: '', label: 'Yeti Nano' }),
        device({ deviceId: 'b', groupId: '', label: 'Built-in Microphone' }),
      ],
      'audioinput',
    );

    expect(shaped.map((d) => d.deviceId)).toEqual(['a', 'b']);
  });

  it('shapes outputs while excluding inputs', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'i', groupId: 'gi', label: 'Yeti Nano' }),
        device({ deviceId: 'o', groupId: 'go', kind: 'audiooutput', label: 'Speakers' }),
      ],
      'audiooutput',
    );

    expect(shaped).toEqual([{ deviceId: 'o', groupId: 'go', isDefault: false, label: 'Speakers' }]);
  });

  it('collapses output aliases into their concrete devices', () => {
    const shaped = shapeDevices(
      [
        device({
          deviceId: 'default',
          groupId: 'go',
          kind: 'audiooutput',
          label: 'Default - Built-in Speakers',
        }),
        device({
          deviceId: 'communications',
          groupId: 'go',
          kind: 'audiooutput',
          label: 'Communications - Built-in Speakers',
        }),
        device({
          deviceId: 'o',
          groupId: 'go',
          kind: 'audiooutput',
          label: 'Built-in Speakers',
        }),
      ],
      'audiooutput',
    );

    expect(shaped).toEqual([
      { deviceId: 'o', groupId: 'go', isDefault: true, label: 'Built-in Speakers' },
    ]);
  });

  it('drops output aliases until a concrete device is exposed', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'default', groupId: '', kind: 'audiooutput' }),
        device({ deviceId: 'communications', groupId: '', kind: 'audiooutput' }),
      ],
      'audiooutput',
    );

    expect(shaped).toEqual([]);
  });

  it('keeps outputs with unknown groups separate and gives them fallback names', () => {
    const shaped = shapeDevices(
      [
        device({ deviceId: 'a', groupId: '', kind: 'audiooutput' }),
        device({ deviceId: 'b', groupId: '', kind: 'audiooutput' }),
      ],
      'audiooutput',
    );

    expect(shaped).toEqual([
      { deviceId: 'a', groupId: '', isDefault: false, label: 'Audio output 1' },
      { deviceId: 'b', groupId: '', isDefault: false, label: 'Audio output 2' },
    ]);
  });
});

describe('resolveSelection', () => {
  const devices = shapeDevices(
    [
      { deviceId: 'a', kind: 'audioinput', label: 'Yeti Nano', groupId: 'ga' },
      { deviceId: 'b', kind: 'audioinput', label: 'Built-in Microphone', groupId: 'gb' },
    ],
    'audioinput',
  );

  it('keeps a selection that is still plugged in', () => {
    expect(resolveSelection(devices, 'b')).toBe('b');
  });

  it('falls back to the first device when the selection is gone', () => {
    expect(resolveSelection(devices, 'gone')).toBe('a');
  });

  it('picks the first device when nothing is selected yet', () => {
    expect(resolveSelection(devices, null)).toBe('a');
  });

  it('is null when there is nothing to select', () => {
    expect(resolveSelection([], 'a')).toBeNull();
  });
});
