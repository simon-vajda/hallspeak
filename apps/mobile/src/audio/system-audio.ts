import { OUTPUT_UNKNOWN_LABEL, outputLabel } from './output';

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

/**
 * The device's own media volume as a percentage. Whole numbers, clamped: the platform is
 * the only source of a level now, and a reading outside the range is a platform quirk
 * rather than something to render.
 */
export function normalizeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return MIN_VOLUME;
  }

  return Math.round(Math.min(Math.max(value, MIN_VOLUME), MAX_VOLUME));
}

export function volumeLabel(volume: number): string {
  return `${normalizeVolume(volume)}%`;
}

/**
 * What the Channel screen's audio line says: where the audio is going and how loud the
 * device is, both of them read from the platform rather than set by this app.
 *
 * Neither platform lets an app choose the media output — routing belongs to the system, and
 * an in-app level could only attenuate below the device's own. So this states the two facts
 * and offers no control that would duplicate the volume keys or fail to move the audio.
 */
export function audioStatus(input: { route: string | null; volume: number }): string {
  const level = volumeLabel(input.volume);

  return input.route === null || input.route.trim() === ''
    ? level
    : `${outputLabel(input.route)} · ${level}`;
}

export { OUTPUT_UNKNOWN_LABEL };
