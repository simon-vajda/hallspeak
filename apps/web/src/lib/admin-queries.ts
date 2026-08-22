import type { components } from '@linguacast/contract/openapi';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { $api } from '@/api/client';

type AdminEventDetail = components['schemas']['AdminEventDetail'];
type AdminLiveChannel = components['schemas']['AdminLiveChannel'];
type AdminLiveEvent = components['schemas']['AdminLiveEvent'];

type AdminEventSnapshot = {
  row: AdminEventDetail | undefined;
  detail: AdminEventDetail | undefined;
};

// Derived from the query options, not written out: a hand-written key can drift from the
// query it refers to with nothing to compile against.
export const eventsListKey = () => $api.queryOptions('get', '/admin/events').queryKey;

export const eventDetailKey = (id: number) =>
  $api.queryOptions('get', '/admin/events/{id}', { params: { path: { id } } }).queryKey;

export const liveKey = () => $api.queryOptions('get', '/admin/live').queryKey;

/** Media state is process memory and moves on its own; nothing invalidates it, so it polls. */
const LIVE_POLL_MS = 5_000;

type AdminLiveIndex = {
  /** Event id → how many of its channels have an interpreter producing. */
  onAir: Map<number, number>;
  /** Channel id → its live entry. */
  channels: Map<number, AdminLiveChannel>;
};

function indexLive(events: AdminLiveEvent[] | undefined): AdminLiveIndex {
  const index: AdminLiveIndex = { onAir: new Map(), channels: new Map() };

  for (const event of events ?? []) {
    let onAir = 0;
    for (const channel of event.channels) {
      index.channels.set(channel.channelId, channel);
      if (channel.online) {
        onAir += 1;
      }
    }
    index.onAir.set(event.eventId, onAir);
  }

  return index;
}

/**
 * Liveness across every event, indexed for lookup. Deliberately its own cache entry rather than
 * a field on `AdminEventDetail`: the optimistic enable/disable helpers rewrite that entry, and a
 * poll landing mid-toggle would undo it.
 *
 * A pending or failed poll yields an empty index rather than an error — an absent event or
 * channel already means zero, so every caller degrades to its idle copy and the admin screens
 * still load with the media layer down.
 */
export function useAdminLive(): AdminLiveIndex {
  const { data } = $api.useQuery('get', '/admin/live', {}, { refetchInterval: LIVE_POLL_MS });

  return useMemo(() => indexLive(data), [data]);
}

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
      if (previous?.detail) {
        queryClient.setQueryData(detailKey, previous.detail);
      }
    },

    settle() {
      return invalidateAdminEvents(queryClient, eventId);
    },
  };
}
