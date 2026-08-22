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
type JoinAck = Parameters<JoinParams[1]>[0];
export const _joinResponse: JoinAck = { ok: true, data: { online: true, muted: false } };
export const _status: Parameters<S2C['channel:status']>[0] = {
  slug: 'english',
  online: true,
  muted: false,
};

// @ts-expect-error — the payload is checked against the event's schema.
export const _wrongJoinPayload: JoinParams[0] = { channel: 'english' };

type ProduceParams = Parameters<C2S['media:produce']>;
type ConsumeParams = Parameters<C2S['media:consume']>;

export const _produceTakesAnAck: ProduceParams['length'] = 2;
export const _closeConsumerTakesAnAck: Parameters<C2S['media:close-consumer']>['length'] = 2;

export const _producePayload: ProduceParams[0] = {
  slug: 'english',
  kind: 'audio',
  rtpParameters: { codecs: [] },
  paused: true,
};
export const _consumePayload: ConsumeParams[0] = {
  slug: 'english',
  rtpCapabilities: { codecs: [] },
};
export const _reset: Parameters<S2C['media:reset']>[0] = { reason: 'worker_died' };

// @ts-expect-error — `producerId`, not `id`.
export const _wrongProducerPayload: Parameters<C2S['media:close-producer']>[0] = { id: 'p1' };

export const _videoProduce: ProduceParams[0] = {
  slug: 'english',
  // @ts-expect-error — audio-only; the contract has no video kind.
  kind: 'video',
  rtpParameters: {},
  paused: false,
};
