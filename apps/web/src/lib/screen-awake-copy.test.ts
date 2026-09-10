import { describe, expect, it } from 'vitest';
import { screenAwakeLabel, screenAwakeNote } from './screen-awake-copy';
import type { ScreenWakeLockStatus } from './use-screen-wake-lock';

const STATUSES: ScreenWakeLockStatus[] = ['unknown', 'held', 'unavailable'];

describe('screen awake copy', () => {
  it('gives each status its own label', () => {
    const labels = STATUSES.map(screenAwakeLabel);
    expect(new Set(labels).size).toBe(STATUSES.length);
  });

  it('reports a held lock as a status and an unavailable one as a warning', () => {
    expect(screenAwakeLabel('held')).toBe('Keeping the screen awake');
    expect(screenAwakeLabel('unavailable')).toBe('Screen may dim');
    expect(screenAwakeLabel('unknown')).toBe('Keep the screen awake');
  });

  it('adds a note only once the request has settled', () => {
    expect(screenAwakeNote('unknown')).toBeNull();
    expect(screenAwakeNote('held')).not.toBeNull();
    expect(screenAwakeNote('unavailable')).not.toBeNull();
  });

  it('never claims anybody is hearing the audio', () => {
    const copy = [
      ...STATUSES.map(screenAwakeLabel),
      ...STATUSES.map(screenAwakeNote).filter((note) => note !== null),
    ].join(' ');
    expect(copy).not.toMatch(/listener|hearing|listening|on air/i);
  });
});
