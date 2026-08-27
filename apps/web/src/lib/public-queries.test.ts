import { describe, expect, it } from 'vitest';
import { publicChannelQueryOptions, publicEventQueryOptions } from './public-queries';

describe('public query options', () => {
  it('keys event queries by PIN', () => {
    expect(publicEventQueryOptions('123456').queryKey).not.toEqual(
      publicEventQueryOptions('654321').queryKey,
    );
  });

  it('keys channel queries by PIN, slug and speaker code', () => {
    const listener = publicChannelQueryOptions('123456', 'english');

    expect(listener.queryKey).not.toEqual(publicChannelQueryOptions('123456', 'spanish').queryKey);
    expect(listener.queryKey).not.toEqual(publicChannelQueryOptions('654321', 'english').queryKey);
    expect(listener.queryKey).not.toEqual(
      publicChannelQueryOptions('123456', 'english', 'speaker-secret').queryKey,
    );
  });
});
