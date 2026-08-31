const HEADER_BYTES = 44;
const SAMPLE_RATE = 8_000;
const BITS_PER_SAMPLE = 8;
const CHANNELS = 1;

export const MEDIA_SESSION_CARRIER_SECONDS = 6;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

/**
 * Builds a tiny, known-duration media resource. Android browsers do not consistently promote
 * a WebRTC `srcObject` to persistent media focus, while a media file longer than five seconds
 * qualifies. Unsigned 8-bit PCM silence is 128, so this remains unmuted without making sound.
 */
export function createMediaSessionCarrierWave(): Uint8Array<ArrayBuffer> {
  const sampleBytes = SAMPLE_RATE * MEDIA_SESSION_CARRIER_SECONDS;
  const bytes = new Uint8Array(HEADER_BYTES + sampleBytes);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS, true);
  view.setUint16(32, CHANNELS, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, sampleBytes, true);
  bytes.fill(128, HEADER_BYTES);

  return bytes;
}
