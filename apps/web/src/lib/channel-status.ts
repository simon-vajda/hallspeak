/** Socket-authoritative broadcast status for one channel. `null` means mute is not known yet. */
export interface ChannelStatus {
  online: boolean;
  muted: boolean | null;
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

function normalizeStatus(status: { online: boolean; muted: boolean }): ChannelStatus {
  return { online: status.online, muted: status.online ? status.muted : false };
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
      Object.entries(state.channels).map(([slug, status]) => [
        slug,
        { ...status, muted: status.online ? null : false, revision: 0 },
      ]),
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
  status: { online: boolean; muted: boolean },
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
 * A failed request normally restores the state from before the optimistic local control.
 * If realtime advanced while it was in flight, that newer server snapshot wins instead.
 */
export function rollbackMutedAfterFailure(input: {
  requestedMuted: boolean;
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
  return !input.requestedMuted;
}
