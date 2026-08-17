import type { z } from 'zod';

/** No `response` means fire-and-forget: the derived signature carries no ack parameter. */
export interface EventDef<
  P extends z.ZodType = z.ZodType,
  R extends z.ZodType | undefined = undefined,
> {
  payload: P;
  response?: R;
}

/** Identity at runtime: it exists purely so P and R are captured by inference. */
export function event<P extends z.ZodType, R extends z.ZodType | undefined = undefined>(def: {
  payload: P;
  response?: R;
}): EventDef<P, R> {
  return def;
}

// Not EventDef<any, any>: Biome's recommended preset bans explicit any.
export type EventMap = Record<string, EventDef<z.ZodType, z.ZodType | undefined>>;

/** Every acked event resolves to this envelope; `unwrap()` collapses it. */
export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type Payload<E> = E extends EventDef<infer P, z.ZodType | undefined> ? z.infer<P> : never;

/**
 * `undefined` rather than `void`: Biome's noConfusingVoidType rejects `void` outside a
 * return position and a suppression will not attach to a type alias body.
 */
export type Response<E> =
  E extends EventDef<z.ZodType, infer R> ? (R extends z.ZodType ? z.infer<R> : undefined) : never;

type HasAck<E> =
  E extends EventDef<z.ZodType, infer R> ? (R extends z.ZodType ? true : false) : false;

/**
 * The trailing ack parameter appears only for events declaring a `response`: Socket.IO
 * reads `emitWithAck`'s return type off it.
 */
export type ClientToServerEvents<T extends EventMap> = {
  [K in keyof T]: HasAck<T[K]> extends true
    ? (payload: Payload<T[K]>, ack: (res: Ack<Response<T[K]>>) => void) => void
    : (payload: Payload<T[K]>) => void;
};

export type ServerToClientEvents<T extends EventMap> = {
  [K in keyof T]: (payload: Payload<T[K]>) => void;
};
