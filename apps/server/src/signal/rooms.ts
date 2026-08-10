// Event and channel rooms are NESTED, not alternatives. A listener on the selector is
// in the event room only and still gets liveness updates; a listener in a channel is
// in both. Aggregate updates fan out to the event room, signalling to the channel
// room (spec E §7).

export const eventRoom = (eventId: number): string => `event:${eventId}`;

export const channelRoom = (channelId: number): string => `channel:${channelId}`;
