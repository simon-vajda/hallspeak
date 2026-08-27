import { describe, expect, it } from 'vitest';
import { eventDetailQueryOptions, eventsListQueryOptions } from './admin-queries';

describe('admin query options', () => {
  it('keeps list and detail keys separate', () => {
    expect(eventsListQueryOptions().queryKey).not.toEqual(eventDetailQueryOptions(1).queryKey);
  });

  it('keys detail queries by event id', () => {
    expect(eventDetailQueryOptions(1).queryKey).not.toEqual(eventDetailQueryOptions(2).queryKey);
  });
});
