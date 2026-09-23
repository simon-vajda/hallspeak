export type WithheldReading = 'value' | 'pending' | 'withheld';

/**
 * An unknown studio reading first shows as pending, then — once `settled` says the grace
 * window has passed — as withheld, so an outage ends in a still em dash rather than a
 * placeholder that pulses forever.
 */
export function withheldReading(value: unknown, settled: boolean): WithheldReading {
  if (value !== undefined) {
    return 'value';
  }
  return settled ? 'withheld' : 'pending';
}
