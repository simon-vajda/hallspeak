/**
 * The pure half of audio-device selection, split from the hooks so the behaviours invisible
 * on a developer's own machine are testable without a DOM: empty labels before permission,
 * and one physical device listed under multiple aliases.
 */

/** Structural stand-in for `MediaDeviceInfo`, so callers and tests can pass plain objects. */
export type DeviceInfoLike = {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
};

export type AudioDevice = {
  deviceId: string;
  label: string;
  groupId: string;
  /** This physical device is also exposed through the browser's `default` alias. */
  isDefault: boolean;
};

/** The browser lists the system default a second time under one of these ids. */
const ALIAS_IDS = new Set(['default', 'communications']);

/** Their labels come prefixed, which reads as a separate device in a picker. */
const ALIAS_LABEL = /^(Default|Communications) - /;

/**
 * One requested audio kind, one entry per physical device, every entry named. An alias keeps
 * its position (the browser lists the default first) but takes the id and label of the concrete
 * entry it duplicates.
 */
export function shapeDevices(
  devices: readonly DeviceInfoLike[],
  kind: 'audioinput',
): AudioDevice[] {
  // The tuple type is what tells the compiler a group is never empty.
  const groups = new Map<string, [DeviceInfoLike, ...DeviceInfoLike[]]>();

  for (const device of devices) {
    if (device.kind !== kind) {
      continue;
    }
    // An empty groupId is Firefox saying "unknown", not "same device as the last unknown".
    const key = device.groupId === '' ? `device:${device.deviceId}` : `group:${device.groupId}`;
    const members = groups.get(key);
    if (members) {
      members.push(device);
    } else {
      groups.set(key, [device]);
    }
  }

  return [...groups.values()].map((members, index) => {
    const primary = members.find((d) => !ALIAS_IDS.has(d.deviceId)) ?? members[0];
    const labels = [primary, ...members].map((d) => d.label.replace(ALIAS_LABEL, ''));

    return {
      deviceId: primary.deviceId,
      groupId: primary.groupId,
      isDefault: members.some((device) => device.deviceId === 'default'),
      label: labels.find((label) => label !== '') ?? `Microphone ${index + 1}`,
    };
  });
}

/** Falls back to the first in the list: that is where the browser puts the system default. */
export function resolveSelection(
  devices: readonly AudioDevice[],
  selected: string | null,
): string | null {
  if (selected !== null && devices.some((d) => d.deviceId === selected)) {
    return selected;
  }
  return devices[0]?.deviceId ?? null;
}
