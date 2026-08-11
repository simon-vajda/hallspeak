import type {
  ClientToServerEvents,
  clientToServer,
  ServerToClientEvents,
  serverToClient,
} from '@linguacast/contract/socket';
import { io, type Socket } from 'socket.io-client';

export type SignalSocket = Socket<
  ServerToClientEvents<typeof serverToClient>,
  ClientToServerEvents<typeof clientToServer>
>;

/** What the server's handshake gate authorizes on. A listener sends only a pin. */
export interface SignalAuth {
  pin: string;
  speakerCode?: string;
}

/**
 * `clientVersion` is a parameter rather than a module constant on purpose: this
 * directory is portable, and baking a web build's version into it is exactly what would
 * break when it lifts into packages/client-core. apps/web/src/version.ts supplies it.
 *
 * An omitted `url` becomes '', which socket.io-client resolves to same-origin — correct
 * in production, and in dev Vite proxies /api to the server (with ws: true).
 */
export function createSignalSocket(opts: {
  clientVersion: string;
  auth: SignalAuth;
  url?: string;
}): SignalSocket {
  return io(opts.url ?? '', {
    path: '/api/socket.io',

    // Supplies a default deadline to EVERY ack, so no call site can forget one — a
    // stronger guarantee than wrapping emit would give. Configuring it also makes
    // Socket.IO reject pending acks on disconnect, covering "the server vanished
    // mid-request". Must stay above the server's HANDLER_TIMEOUT_MS of 8s so a wedged
    // handler reports a real `timeout` ack rather than timing out locally.
    ackTimeout: 10_000,

    // NEVER add `retries`. It enables packet buffering and automatic replay, which is
    // wrong for signalling: produce and connectTransport are not idempotent and must
    // never be silently repeated. ackTimeout is independent of it.

    // Connection is an explicit act at a point the app chooses.
    autoConnect: false,

    // Replayed verbatim by Socket.IO on every reconnect, which is why the server
    // re-establishes room membership in its connect handler rather than assuming it
    // sticks.
    auth: { clientVersion: opts.clientVersion, ...opts.auth },
  }) as SignalSocket;
}
