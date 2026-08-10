import type { z } from 'zod';

/**
 * One event's wire contract. `response` absent means fire-and-forget: the derived
 * client-to-server signature then carries no ack parameter at all.
 */
export interface EventDef<
  P extends z.ZodType = z.ZodType,
  R extends z.ZodType | undefined = undefined,
> {
  payload: P;
  response?: R;
}

/**
 * The socket analogue of the contract's `createRoute`: data at runtime, types by
 * inference. Identity at runtime — it exists purely so P and R are captured.
 */
export function event<P extends z.ZodType, R extends z.ZodType | undefined = undefined>(def: {
  payload: P;
  response?: R;
}): EventDef<P, R> {
  return def;
}

// Not EventDef<any, any>: Biome's recommended preset bans explicit any.
export type EventMap = Record<string, EventDef<z.ZodType, z.ZodType | undefined>>;

/** Every acknowledged event resolves to this envelope. `unwrap()` collapses it. */
export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type Payload<E> = E extends EventDef<infer P, z.ZodType | undefined> ? z.infer<P> : never;

export type Response<E> =
  E extends EventDef<z.ZodType, infer R> ? (R extends z.ZodType ? z.infer<R> : void) : never;

type HasAck<E> =
  E extends EventDef<z.ZodType, infer R> ? (R extends z.ZodType ? true : false) : false;

/**
 * Derived maps satisfy Socket.IO's own `EventsMap` constraint, so they can be handed
 * straight to `Server<C2S, S2C>` and `Socket<S2C, C2S>`.
 *
 * The trailing ack parameter appears ONLY for events declaring a `response`, because
 * Socket.IO reads `emitWithAck`'s return type off that trailing parameter. That is what
 * makes `await socket.emitWithAck('ping', {})` come back as `Ack<{ serverTime: number }>`
 * with no annotation, and what makes passing a callback to a fire-and-forget event a
 * compile error.
 */
export type ClientToServerEvents<T extends EventMap> = {
  [K in keyof T]: HasAck<T[K]> extends true
    ? (payload: Payload<T[K]>, ack: (res: Ack<Response<T[K]>>) => void) => void
    : (payload: Payload<T[K]>) => void;
};

export type ServerToClientEvents<T extends EventMap> = {
  [K in keyof T]: (payload: Payload<T[K]>) => void;
};
