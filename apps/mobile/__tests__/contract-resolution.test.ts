// Guards R3/KTD2: the contract is consumed as TypeScript source with no build step, so a
// change to its exports map or to Metro/Jest resolution has to fail here rather than at
// runtime on a device.
import { describe, expect, it } from '@jest/globals';
import { PIN_PATTERN } from '@linguacast/contract/patterns';
import { clientToServer } from '@linguacast/contract/socket';

describe('@linguacast/contract resolves as source', () => {
  it('exposes the shared PIN pattern as a runtime value', () => {
    expect(PIN_PATTERN.test('482913')).toBe(true);
    expect(PIN_PATTERN.test('48291')).toBe(false);
  });

  it('exposes the socket contract without pulling in the Hono-bearing root barrel', () => {
    expect(Object.keys(clientToServer)).toContain('channel:report');
  });
});
