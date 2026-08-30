/** Socket-authoritative broadcast status for one channel. `null` means mute is not known yet. */
export interface ChannelStatus {
  online: boolean;
  muted: boolean | null;
  reason?: 'ended' | 'dropped';
}

export interface ChannelStatusEntry extends ChannelStatus {
  /** Realtime changes seen during the current socket connection. */
  revision: number;
}

export interface ChannelStatusState {
  /** Invalidates join acknowledgements started on an older connection or auth context. */
  connectionRevision: number;
  channels: Record<string, ChannelStatusEntry>;
}

export const initialChannelStatuses: ChannelStatusState = {
  connectionRevision: 0,
  channels: {},
};

export interface ChannelJoinTicket {
  slug: string;
  connectionRevision: number;
  realtimeRevision: number;
}

/** Compatibility view for selectors, derived from the one revisioned status map. */
export function projectOnlineStatuses(
  channels: Record<string, ChannelStatusEntry>,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(channels).map(([slug, status]) => [slug, status.online]),
  );
}

/** REST owns liveness only. An online response cannot say whether its producer is paused. */
export function channelStatusFromHttp(online: boolean): ChannelStatus {
  return { online, muted: online ? null : false };
}

function normalizeStatus(status: {
  online: boolean;
  muted: boolean;
  reason?: 'ended' | 'dropped';
}): ChannelStatus {
  return {
    online: status.online,
    muted: status.online ? status.muted : false,
    ...(status.reason === undefined ? {} : { reason: status.reason }),
  };
}

/** Clears values as well as ordering when the PIN or speaker authority changes. */
export function resetStatusesForAuth(state: ChannelStatusState): ChannelStatusState {
  return { connectionRevision: state.connectionRevision + 1, channels: {} };
}

/**
 * A reconnect starts a new ordering domain. The last snapshot stayed available while
 * reconnecting presentation outranked it; once connected, online mute becomes unknown
 * until the new connection receives its own join or realtime snapshot.
 */
export function resetStatusOrdering(state: ChannelStatusState): ChannelStatusState {
  return {
    connectionRevision: state.connectionRevision + 1,
    channels: Object.fromEntries(
      Object.entries(state.channels).map(([slug, status]) => {
        const { reason: _, ...current } = status;
        return [slug, { ...current, ...channelStatusFromHttp(status.online), revision: 0 }];
      }),
    ),
  };
}

export function beginChannelJoin(
  state: ChannelStatusState,
  slug: string,
  httpOnline: boolean,
): { state: ChannelStatusState; ticket: ChannelJoinTicket } {
  const existing = state.channels[slug];
  const seeded: ChannelStatusEntry = existing ?? {
    ...channelStatusFromHttp(httpOnline),
    revision: 0,
  };
  const next = existing ? state : { ...state, channels: { ...state.channels, [slug]: seeded } };

  return {
    state: next,
    ticket: {
      slug,
      connectionRevision: next.connectionRevision,
      realtimeRevision: seeded.revision,
    },
  };
}

export function applyRealtimeStatus(
  state: ChannelStatusState,
  slug: string,
  status: { online: boolean; muted: boolean; reason?: 'ended' | 'dropped' },
): ChannelStatusState {
  const current = state.channels[slug];
  return {
    ...state,
    channels: {
      ...state.channels,
      [slug]: {
        ...normalizeStatus(status),
        revision: (current?.revision ?? 0) + 1,
      },
    },
  };
}

export function applyJoinStatus(
  state: ChannelStatusState,
  ticket: ChannelJoinTicket,
  status: { online: boolean; muted: boolean },
): ChannelStatusState {
  const current = state.channels[ticket.slug];
  if (
    state.connectionRevision !== ticket.connectionRevision ||
    current?.revision !== ticket.realtimeRevision
  ) {
    return state;
  }

  return {
    ...state,
    channels: {
      ...state.channels,
      [ticket.slug]: { ...normalizeStatus(status), revision: current.revision },
    },
  };
}

/**
 * Where a failed mute control leaves the interpreter. If realtime advanced while the request
 * was in flight, that newer server snapshot wins.
 *
 * Otherwise both directions fail safe to muted, rather than undoing what was asked. A failed
 * pause must never put an interpreter back on air: the local `producer.pause()` has already
 * stopped the audio, they believe they are muted, and resuming would be the one failure they
 * cannot see. A failed resume is muted in effect anyway — the server still has every listener's
 * consumer paused — so saying muted is what matches what the room can hear.
 */
export function rollbackMutedAfterFailure(input: {
  requestRevision: number;
  current: ChannelStatusEntry | undefined;
}): boolean {
  if (
    input.current &&
    input.current.revision > input.requestRevision &&
    input.current.muted !== null
  ) {
    return input.current.muted;
  }
  return true;
}
