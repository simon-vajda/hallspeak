// The two rooms are nested, not alternatives: a listener in a channel is in both.
// Aggregate updates fan out to the event room, per-channel signalling to the channel room.

export const eventRoom = (eventId: number): string => `event:${eventId}`;

export const channelRoom = (channelId: number): string => `channel:${channelId}`;
