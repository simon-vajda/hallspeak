import type { components } from '@linguacast/contract/openapi';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { $api } from '@/api/client';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

/**
 * What both caches held for **one** event before an optimistic write, and what a failure
 * restores. Deliberately not the whole list — see the comment on `apply`.
 */
type AdminEventSnapshot = {
  row: AdminEventDetail | undefined;
  detail: AdminEventDetail | undefined;
};

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

/**
 * Mutation scope for one event. React Query runs mutations sharing a scope serially, so
 * every write that lands in these two caches queues behind the last one instead of racing
 * it. Channel writes share their event's scope, because they rewrite the same two entries.
 */
export const eventScope = (eventId: number) => `admin-event-${eventId}`;

/**
 * The optimistic half of the same rule: an enable switch appears on both screens, so a
 * write has to land in both caches or the two disagree until the refetch arrives. Callers
 * supply only the change itself — everything around it (cancelling in-flight reads,
 * snapshotting for rollback, settling) is the same wherever an event is patched in place.
 *
 * Pass the three returned functions straight to a mutation's `onMutate`, `onError` and
 * `onSettled`; `apply` resolves to the snapshot react-query hands back as context.
 */
export function useOptimisticEventUpdate(eventId: number) {
  const queryClient = useQueryClient();
  const listKey = eventsListKey();
  const detailKey = eventDetailKey(eventId);

  return {
    async apply(patch: (event: AdminEventDetail) => AdminEventDetail) {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);

      // Only this event's row is snapshotted, never the whole list. Both screens render a
      // switch per row against these two keys, so restoring an entire array would also
      // restore every other row as it was before — undoing a second toggle that is still
      // in flight beside this one.
      const previous: AdminEventSnapshot = {
        row: queryClient.getQueryData<AdminEventDetail[]>(listKey)?.find((e) => e.id === eventId),
        detail: queryClient.getQueryData(detailKey),
      };

      queryClient.setQueryData<AdminEventDetail[]>(listKey, (events) =>
        events?.map((event) => (event.id === eventId ? patch(event) : event)),
      );
      queryClient.setQueryData<AdminEventDetail>(detailKey, (event) => event && patch(event));

      return previous;
    },

    rollback(previous: AdminEventSnapshot | undefined) {
      const row = previous?.row;
      if (row) {
        queryClient.setQueryData<AdminEventDetail[]>(listKey, (events) =>
          events?.map((event) => (event.id === eventId ? row : event)),
        );
      }
      if (previous?.detail) queryClient.setQueryData(detailKey, previous.detail);
    },

    settle() {
      return invalidateAdminEvents(queryClient, eventId);
    },
  };
}
