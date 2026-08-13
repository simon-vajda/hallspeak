import type { QueryClient } from '@tanstack/react-query';
import { $api } from '@/api/client';

/**
 * The two admin queries every screen and mutation addresses. They live together because a
 * cache key written out at the call site is a key that can drift from the query it refers
 * to, silently, with nothing to compile against.
 */
export const eventsListKey = () => $api.queryOptions('get', '/admin/events').queryKey;

export const eventDetailKey = (id: number) =>
  $api.queryOptions('get', '/admin/events/{id}', { params: { path: { id } } }).queryKey;

/**
 * Every event and channel mutation moves both: the list's chips are derived from the same
 * channels the detail page shows, so invalidating one alone leaves the other stale.
 */
export function invalidateAdminEvents(queryClient: QueryClient, eventId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: eventDetailKey(eventId) }),
    queryClient.invalidateQueries({ queryKey: eventsListKey() }),
  ]);
}
