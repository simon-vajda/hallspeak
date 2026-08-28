import type { AudioDevice } from './devices';

/** One browser-wide choice, separate from interpreter capture preferences. */
export const AUDIO_OUTPUT_STORAGE_KEY = 'linguacast-audio-output';

/** Storage is JSON so malformed and non-string values can be rejected without ambiguity. */
export function parseStoredOutput(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'string' && parsed !== '' ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeOutput(deviceId: string): string {
  return JSON.stringify(deviceId);
}

/** Safe during server rendering and pure-helper tests. */
export function supportsAudioOutputSelection(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

/** An unpermissioned browser may expose one anonymous output, which is not a usable list. */
export function hasNamedOutputs(devices: readonly AudioDevice[]): boolean {
  return devices.some(
    (device) =>
      device.deviceId !== '' &&
      device.deviceId !== 'default' &&
      device.deviceId !== 'communications',
  );
}

/** Missing stored choices follow the system default instead of selecting another explicit id. */
export function resolveOutputSelection(
  devices: readonly AudioDevice[],
  stored: string | null,
): string | null {
  const defaultDevice = devices.find((device) => device.isDefault) ?? devices[0];
  if (stored === defaultDevice?.deviceId) {
    return null;
  }
  return stored !== null && devices.some((device) => device.deviceId === stored) ? stored : null;
}
