import type { clientToServer } from './contract';
import type { Ack, ClientToServerEvents, Payload, Response } from './define';

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type C2S = ClientToServerEvents<typeof clientToServer>;

/** Fails if `as const` is dropped from the contract. */
type _Names = Expect<Equal<keyof C2S, 'ping' | 'channel:join' | 'channel:leave'>>;

type _Ping = Expect<
  Equal<
    C2S['ping'],
    (payload: Record<string, never>, ack: (res: Ack<{ serverTime: number }>) => void) => void
  >
>;

type _PingPayload = Expect<Equal<Payload<(typeof clientToServer)['ping']>, Record<string, never>>>;
type _PingResponse = Expect<
  Equal<Response<(typeof clientToServer)['ping']>, { serverTime: number }>
>;

export type { _Names, _Ping, _PingPayload, _PingResponse };
