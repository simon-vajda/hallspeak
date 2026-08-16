import { describe, expect, it } from 'vitest';
import { type DeviceInfoLike, resolveSelection, shapeDevices } from './devices';

function device(partial: Partial<DeviceInfoLike>): DeviceInfoLike {
  return { deviceId: 'id', kind: 'audioinput', label: '', groupId: 'group', ...partial };
}

describe('shapeDevices', () => {
  // labels are empty strings until getUserMedia has been granted once, so the picker has
  // to name them itself or render a list of blanks
  it('names unlabelled devices sequentially in list order', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'a', groupId: 'ga' }),
      device({ deviceId: 'b', groupId: 'gb' }),
      device({ deviceId: 'c', groupId: 'gc' }),
    ]);

    expect(shaped.map((d) => d.label)).toEqual(['Microphone 1', 'Microphone 2', 'Microphone 3']);
    expect(shaped.map((d) => d.deviceId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps real labels once permission has been granted', () => {
    const shaped = shapeDevices([device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' })]);
    expect(shaped).toEqual([{ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }]);
  });

  it('collapses the default alias into the real device it points at', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'default', groupId: 'ga', label: 'Default - Yeti Nano' }),
      device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
      device({ deviceId: 'b', groupId: 'gb', label: 'Built-in Microphone' }),
    ]);

    expect(shaped).toEqual([
      { deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' },
      { deviceId: 'b', groupId: 'gb', label: 'Built-in Microphone' },
    ]);
  });

  it('keeps the default alias first, where the browser put it', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'default', groupId: 'gb', label: 'Default - Built-in Microphone' }),
      device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
      device({ deviceId: 'b', groupId: 'gb', label: 'Built-in Microphone' }),
    ]);

    expect(shaped.map((d) => d.deviceId)).toEqual(['b', 'a']);
  });

  it('collapses the communications alias too', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'communications', groupId: 'ga', label: 'Communications - Yeti Nano' }),
      device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
    ]);

    expect(shaped).toEqual([{ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }]);
  });

  it('drops outputs and anything that is not an audio input', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'a', groupId: 'ga', label: 'Yeti Nano' }),
      device({ deviceId: 'o', groupId: 'go', kind: 'audiooutput', label: 'Speakers' }),
      device({ deviceId: 'v', groupId: 'gv', kind: 'videoinput', label: 'FaceTime HD' }),
    ]);

    expect(shaped.map((d) => d.deviceId)).toEqual(['a']);
  });

  it('returns an empty list when there are no inputs at all', () => {
    expect(shapeDevices([])).toEqual([]);
    expect(shapeDevices([device({ kind: 'audiooutput' })])).toEqual([]);
  });

  // Firefox reports an empty groupId for some devices; grouping on it blindly would fold
  // every such device into one entry
  it('does not collapse distinct devices that share an empty groupId', () => {
    const shaped = shapeDevices([
      device({ deviceId: 'a', groupId: '', label: 'Yeti Nano' }),
      device({ deviceId: 'b', groupId: '', label: 'Built-in Microphone' }),
    ]);

    expect(shaped.map((d) => d.deviceId)).toEqual(['a', 'b']);
  });
});

describe('resolveSelection', () => {
  const devices = shapeDevices([
    { deviceId: 'a', kind: 'audioinput', label: 'Yeti Nano', groupId: 'ga' },
    { deviceId: 'b', kind: 'audioinput', label: 'Built-in Microphone', groupId: 'gb' },
  ]);

  it('keeps a selection that is still plugged in', () => {
    expect(resolveSelection(devices, 'b')).toBe('b');
  });

  // the USB mic was unplugged mid-session: fall back rather than hold a dead id
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
