import { describe, expect, it } from 'vitest';
import { eventDetailQueryOptions, eventsListQueryOptions, indexLive } from './admin-queries';

describe('admin query options', () => {
  it('keeps list and detail keys separate', () => {
    expect(eventsListQueryOptions().queryKey).not.toEqual(eventDetailQueryOptions(1).queryKey);
  });

  it('keys detail queries by event id', () => {
    expect(eventDetailQueryOptions(1).queryKey).not.toEqual(eventDetailQueryOptions(2).queryKey);
  });
});

const event = (eventId: number, channels: { channelId: number; online: boolean }[]) => ({
  eventId,
  channels: channels.map((channel) => ({
    ...channel,
    slug: `c${channel.channelId}`,
    listeners: channel.online ? 3 : 0,
  })),
});

describe('indexLive', () => {
  it('counts the channels of each event that are on air', () => {
    const index = indexLive(
      [
        event(1, [
          { channelId: 10, online: true },
          { channelId: 11, online: false },
          { channelId: 12, online: true },
        ]),
        event(2, [{ channelId: 20, online: false }]),
      ],
      true,
    );

    expect(index.onAir.get(1)).toBe(2);
    expect(index.onAir.get(2)).toBe(0);
  });

  it('indexes each channel so a row can find its own entry', () => {
    const index = indexLive([event(1, [{ channelId: 10, online: true }])], true);

    expect(index.channels.get(10)).toEqual({
      channelId: 10,
      slug: 'c10',
      online: true,
      listeners: 3,
    });
    expect(index.channels.get(99)).toBeUndefined();
  });

  it('carries a healthy poll as known, so callers may read the maps', () => {
    expect(indexLive([], true).known).toBe(true);
  });

  it('carries a pending or failing poll as unknown, so an empty index is not read as idle', () => {
    const index = indexLive(undefined, false);

    expect(index.known).toBe(false);
    expect(index.channels.size).toBe(0);
    expect(index.onAir.size).toBe(0);
  });
});
