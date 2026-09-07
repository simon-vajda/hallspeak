import { describe, expect, it } from '@jest/globals';
import type { components } from '@linguacast/contract/openapi';
import { PIN_PATTERN, SLUG_PATTERN } from '@linguacast/contract/patterns';

// `./schemas` is deliberately absent from this file: it imports `@hono/zod-openapi`, so the
// second subpath this seam has to cover is the type-only `./openapi`, asserted by `tsc`.
type PublicEvent = components['schemas']['PublicEvent'];

const event: PublicEvent = {
  pin: '834912',
  name: 'Sunday service',
  description: null,
  channels: [{ slug: 'magyar', name: 'Magyar', online: false }],
};

describe('contract resolution', () => {
  it('resolves the patterns subpath as TypeScript source', () => {
    expect(PIN_PATTERN.test('834912')).toBe(true);
    expect(PIN_PATTERN.test('83491')).toBe(false);
  });

  it('resolves slug rules from the same subpath', () => {
    expect(SLUG_PATTERN.test(event.channels[0]?.slug ?? '')).toBe(true);
  });
});
