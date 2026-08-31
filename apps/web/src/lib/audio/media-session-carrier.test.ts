import { describe, expect, it } from 'vitest';
import {
  createMediaSessionCarrierWave,
  MEDIA_SESSION_CARRIER_SECONDS,
} from './media-session-carrier';

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

describe('Media Session carrier wave', () => {
  it('is a valid six-second mono PCM wave', () => {
    const bytes = createMediaSessionCarrierWave();
    const view = new DataView(bytes.buffer);
    const sampleRate = view.getUint32(24, true);
    const channels = view.getUint16(22, true);
    const sampleBytes = view.getUint32(40, true);

    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(ascii(bytes, 8, 4)).toBe('WAVE');
    expect(ascii(bytes, 12, 4)).toBe('fmt ');
    expect(ascii(bytes, 36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(8);
    expect(sampleBytes / (sampleRate * channels)).toBe(MEDIA_SESSION_CARRIER_SECONDS);
  });

  it('contains digital silence without muting the media element', () => {
    const bytes = createMediaSessionCarrierWave();

    expect(bytes[44]).toBe(128);
    expect(bytes.at(-1)).toBe(128);
  });
});
