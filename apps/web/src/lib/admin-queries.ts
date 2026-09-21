import type { components } from '@hallspeak/contract/openapi';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { $api } from '@/api/client';

type AdminEventDetail = components['schemas']['AdminEventDetail'];
type AdminLiveChannel = components['schemas']['AdminLiveChannel'];
type AdminLiveEvent = components['schemas']['AdminLiveEvent'];

type AdminEventSnapshot = {
  row: AdminEventDetail | undefined;
  detail: AdminEventDetail | undefined;
};

export const eventsListQueryOptions = () => $api.queryOptions('get', '/admin/events');

export const eventDetailQueryOptions = (id: number) =>
  $api.queryOptions('get', '/admin/events/{id}', { params: { path: { id } } });

export const adminLiveQueryOptions = () =>
  $api.queryOptions('get', '/admin/live', {}, { refetchInterval: LIVE_POLL_MS });

// Derived from the query options, not written out: a hand-written key can drift from the
// query it refers to with nothing to compile against.
export const eventsListKey = () => eventsListQueryOptions().queryKey;

export const eventDetailKey = (id: number) => eventDetailQueryOptions(id).queryKey;

export const liveKey = () => adminLiveQueryOptions().queryKey;

/** Media state is process memory and moves on its own; nothing invalidates it, so it polls. */
const LIVE_POLL_MS = 5_000;

/**
 * How old the last answer may be before it stops counting as a reading. Three missed polls:
 * long enough that one slow answer is not a blackout, short enough that an organiser does not
 * act on a minute-old picture.
 */
const LIVE_STALE_AFTER_MS = LIVE_POLL_MS * 3;

/**
 * Whether the last answer can still be believed. Query status alone cannot say: a request the
 * server accepts and never answers is neither a success nor an error, and `refetchInterval`
 * starts no new poll while one is in flight — so a hung server would otherwise keep the last
 * payload marked current forever, which is exactly the stale-reading-as-fresh case the
 * withheld state exists to prevent.
 */
export function isLiveReadingFresh(
  isSuccess: boolean,
  dataUpdatedAt: number,
  now: number,
): boolean {
  return isSuccess && now - dataUpdatedAt < LIVE_STALE_AFTER_MS;
}

type AdminLiveIndex = {
  /**
   * Whether the poll has an answer at all. False while the first poll is in flight and again
   * once one fails: an absent channel then means "not known", not "idle", and a caller reading
   * the maps without checking this would print a quiet room the media layer never reported.
   */
  known: boolean;
  /** Event id → how many of its channels have an interpreter producing. */
  onAir: Map<number, number>;
  /** Channel id → its live entry. */
  channels: Map<number, AdminLiveChannel>;
};

export function indexLive(events: AdminLiveEvent[] | undefined, known: boolean): AdminLiveIndex {
  const index: AdminLiveIndex = { known, onAir: new Map(), channels: new Map() };

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
 * A pending or failed poll yields an empty index rather than an error, so the admin screens still
 * load with the media layer down. It carries `known: false` with it: the emptiness is the poll
 * having no answer, and a caller must withhold rather than read it as nobody broadcasting.
 */
export function useAdminLive(): AdminLiveIndex {
  const { data, isSuccess, dataUpdatedAt } = $api.useQuery(
    'get',
    '/admin/live',
    {},
    { refetchInterval: LIVE_POLL_MS },
  );

  // A hung poll produces no state change at all, so the clock is the only thing that can
  // notice it: without this tick the last answer would keep re-rendering as current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const known = isLiveReadingFresh(isSuccess, dataUpdatedAt, now);
  return useMemo(() => indexLive(known ? data : undefined, known), [data, known]);
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
