import { describe, expect, it } from '@jest/globals';
import { inboundEntry } from './stats-entry';

describe('inboundEntry', () => {
  it('finds the inbound entry among transport and candidate rows', () => {
    const entry = inboundEntry([
      { type: 'transport' },
      { type: 'candidate-pair' },
      { type: 'inbound-rtp', packetsReceived: 12 },
      { type: 'local-candidate' },
    ]);

    expect(entry).toEqual({ type: 'inbound-rtp', packetsReceived: 12 });
  });

  it('returns nothing from a report with no inbound entry', () => {
    expect(inboundEntry([{ type: 'transport' }, { type: 'candidate-pair' }])).toBeUndefined();
  });

  it('ignores a remote-inbound entry, which describes a stream a listener never sends', () => {
    expect(inboundEntry([{ type: 'remote-inbound-rtp', fractionLost: 0.5 }])).toBeUndefined();
  });

  it('returns nothing for an empty report', () => {
    expect(inboundEntry([])).toBeUndefined();
  });
});
