import type { clientToServer, serverToClient } from './contract';
import type { ClientToServerEvents, ServerToClientEvents } from './define';

type C2S = ClientToServerEvents<typeof clientToServer>;
type S2C = ServerToClientEvents<typeof serverToClient>;

type JoinParams = Parameters<C2S['channel:join']>;
type LeaveParams = Parameters<C2S['channel:leave']>;

export const _joinTakesAnAck: JoinParams['length'] = 2;
export const _leaveTakesNoAck: LeaveParams['length'] = 1;

export const _joinPayload: JoinParams[0] = { slug: 'english' };
export const _leavePayload: LeaveParams[0] = { slug: 'english' };
export const _status: Parameters<S2C['channel:status']>[0] = { slug: 'english', online: true };

// @ts-expect-error — the payload is checked against the event's schema.
export const _wrongJoinPayload: JoinParams[0] = { channel: 'english' };
