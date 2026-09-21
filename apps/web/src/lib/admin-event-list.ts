import type { components } from '@hallspeak/contract/openapi';
import { eventStatusLabel, plural } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export const ADMIN_EVENT_TABLE_COLUMNS = 'grid-cols-[1.8fr_0.85fr_1.9fr_0.95fr_110px]';

export function adminEventStatusLabel(event: AdminEventDetail, onAir: number, liveKnown: boolean) {
  return eventStatusLabel({
    enabled: event.enabled,
    channels: event.channels.length,
    onAir,
    liveKnown,
  });
}

export function summariseAdminEvents(events: AdminEventDetail[]): string {
  if (events.length === 0) {
    return 'Nothing here yet';
  }

  const enabled = events.filter((event) => event.enabled).length;
  const channels = events.reduce((total, event) => total + event.channels.length, 0);
  return `${enabled} of ${plural(events.length, 'event')} enabled · ${plural(channels, 'channel')}`;
}
