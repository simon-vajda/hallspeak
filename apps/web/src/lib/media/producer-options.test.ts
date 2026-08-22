import { describe, expect, it } from 'vitest';
import { PRODUCER_OPTIONS } from './use-media';

describe('PRODUCER_OPTIONS', () => {
  it('leaves the track alone when the producer closes', () => {
    // mediasoup-client defaults `stopTracks` to true, which stops the capture layer's
    // output track on End broadcast; the next Go live then throws "track ended" and the
    // studio sits at connecting forever.
    expect(PRODUCER_OPTIONS.stopTracks).toBe(false);
  });
});
