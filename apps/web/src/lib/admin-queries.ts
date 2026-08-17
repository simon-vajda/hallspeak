import type { components } from '@linguacast/contract/openapi';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { $api } from '@/api/client';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

type AdminEventSnapshot = {
  row: AdminEventDetail | undefined;
  detail: AdminEventDetail | undefined;
};

// Derived from the query options, not written out: a hand-written key can drift from the
// query it refers to with nothing to compile against.
export const eventsListKey = () => $api.queryOptions('get', '/admin/events').queryKey;

export const eventDetailKey = (id: number) =>
  $api.queryOptions('get', '/admin/events/{id}', { params: { path: { id } } }).queryKey;

/** Both, always: the list's chips come from the same channels the detail page shows. */
export function invalidateAdminEvents(queryClient: QueryClient, eventId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: eventDetailKey(eventId) }),
    queryClient.invalidateQueries({ queryKey: eventsListKey() }),
  ]);
}

/**
 * React Query runs mutations sharing a scope serially. Channel writes take their event's
 * scope, because they rewrite the same two cache entries.
 */
export const eventScope = (eventId: number) => `admin-event-${eventId}`;

/**
 * Pass the three returned functions to a mutation's `onMutate`, `onError` and `onSettled`;
 * `apply` resolves to the snapshot react-query hands back as context.
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

      // This event's row, never the whole list: restoring an entire array would undo a
      // second toggle still in flight beside this one.
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
