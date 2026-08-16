/**
 * The pure half of microphone selection: a raw `enumerateDevices()` list in, the list the
 * picker renders out. Split from the hook so the two behaviours that are invisible on a
 * developer's own machine — empty labels before permission, and the same mic listed twice
 * — are testable without a DOM.
 *
 * Web-only, like everything under `lib/audio`: `navigator.mediaDevices` has no React Native
 * equivalent, so none of this is a `packages/client-core` candidate.
 */

/** Structural stand-in for `MediaDeviceInfo`, so callers and tests can pass plain objects. */
export type DeviceInfoLike = {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
};

export type MicDevice = {
  deviceId: string;
  label: string;
  groupId: string;
};

/**
 * Ids the browser hands out as *aliases* for whatever the OS currently considers the
 * default: they name a second entry pointing at a device that is already in the list.
 */
const ALIAS_IDS = new Set(['default', 'communications']);

/** Their labels come prefixed, which reads as a separate device in a picker. */
const ALIAS_LABEL = /^(Default|Communications) - /;

/**
 * Audio inputs only, one entry per physical device, every entry named.
 *
 * The alias entries keep their *position* (the browser lists the default first, and that
 * is the order the picker wants) but surrender their id and label to the concrete entry
 * they duplicate — selecting an alias id would work, but the same mic would appear twice.
 */
export function shapeDevices(devices: readonly DeviceInfoLike[]): MicDevice[] {
  // the tuple type is what tells the compiler a group is never empty
  const groups = new Map<string, [DeviceInfoLike, ...DeviceInfoLike[]]>();

  for (const device of devices) {
    if (device.kind !== 'audioinput') continue;
    // an empty groupId is Firefox saying "unknown", not "same device as the last unknown"
    const key = device.groupId === '' ? `device:${device.deviceId}` : `group:${device.groupId}`;
    const members = groups.get(key);
    if (members) members.push(device);
    else groups.set(key, [device]);
  }

  return [...groups.values()].map((members, index) => {
    const primary = members.find((d) => !ALIAS_IDS.has(d.deviceId)) ?? members[0];
    const labels = [primary, ...members].map((d) => d.label.replace(ALIAS_LABEL, ''));

    return {
      deviceId: primary.deviceId,
      groupId: primary.groupId,
      label: labels.find((label) => label !== '') ?? `Microphone ${index + 1}`,
    };
  });
}

/**
 * The device to actually open: the current selection if it is still present, otherwise the
 * first in the list — which is the system default, since that is where the browser puts it.
 */
export function resolveSelection(
  devices: readonly MicDevice[],
  selected: string | null,
): string | null {
  if (selected !== null && devices.some((d) => d.deviceId === selected)) return selected;
  return devices[0]?.deviceId ?? null;
}
