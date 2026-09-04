import type { EventLookup, PublicChannel } from './types';
import { displayHost } from './venue-list';

export type ChannelRowView = {
  slug: string;
  name: string;
  online: boolean;
  /** Always present in both states, so a row gains and loses no element as the flag changes. */
  statusLabel: string;
  actionLabel: string;
};

export type ChannelPickerView =
  | { kind: 'empty'; title: string; body: string }
  | { kind: 'channels'; rows: ChannelRowView[] };

export type EventView =
  | {
      kind: 'event';
      name: string;
      /** Absent rather than empty when the event carries none, so no blank line is reserved. */
      description?: string;
      host: string;
      picker: ChannelPickerView;
      note: string;
    }
  | { kind: 'missing'; title: string; body: string }
  | { kind: 'unreachable'; title: string; body: string };

export const PICKER_LABEL = 'Choose a channel';

const ON_AIR = { status: 'On air', action: 'Listen' } as const;
const OFFLINE = { status: 'Offline', action: 'Open' } as const;

/**
 * The flag is read once, when the event is fetched. The copy promises nothing beyond that and
 * points at the gesture that actually re-reads it.
 */
const NOTE = 'Channels turn on when their interpreter connects. Pull down to check again.';

const EMPTY_PICKER = {
  kind: 'empty',
  title: 'No channels yet',
  body: 'This event has no channels to choose from.',
} as const;

/**
 * Names no cause and carries no PIN or host: a missing event, a disabled one and a wrong PIN
 * are one 404 at the server, and this screen must not undo that parity by wording them apart.
 */
const MISSING = {
  kind: 'missing',
  title: 'That event is not available',
  body: 'Check the PIN, or scan the code at your venue again.',
} as const;

/**
 * React Native reports an untrusted certificate and an unreachable host identically, so the
 * copy claims neither.
 */
const UNREACHABLE = {
  kind: 'unreachable',
  title: "Couldn't load this event",
  body: 'Try again in a moment.',
} as const;

function toRow(channel: PublicChannel): ChannelRowView {
  const labels = channel.online ? ON_AIR : OFFLINE;
  return {
    slug: channel.slug,
    name: channel.name,
    online: channel.online,
    statusLabel: labels.status,
    actionLabel: labels.action,
  };
}

function toPicker(channels: PublicChannel[]): ChannelPickerView {
  if (channels.length === 0) {
    return EMPTY_PICKER;
  }
  return { kind: 'channels', rows: channels.map(toRow) };
}

/** The whole screen as data, so the parity rule holds in one place rather than at each region. */
export function buildEventView(lookup: EventLookup, host: string): EventView {
  if (lookup.outcome === 'not_found') {
    return MISSING;
  }
  if (lookup.outcome === 'unreachable') {
    return UNREACHABLE;
  }

  const description = lookup.event.description?.trim();
  return {
    kind: 'event',
    name: lookup.event.name,
    ...(description ? { description } : {}),
    host: displayHost(host),
    picker: toPicker(lookup.event.channels),
    note: NOTE,
  };
}
