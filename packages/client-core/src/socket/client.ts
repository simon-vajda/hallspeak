import type {
  ClientToServerEvents,
  clientToServer,
  ServerToClientEvents,
  serverToClient,
} from '@hallspeak/contract/socket';
import { io, type Socket } from 'socket.io-client';

export type SocketClient = Socket<
  ServerToClientEvents<typeof serverToClient>,
  ClientToServerEvents<typeof clientToServer>
>;

/**
 * What the server's handshake gate authorizes on. A listener sends only a pin.
 *
 * `studioSession` identifies one studio page, never a person, and travels only with a
 * speaker code: the claim survives that page's reconnects and nothing else. Generating it
 * belongs to the app, which has a platform's random source; this tier only carries it.
 */
export interface SocketAuth {
  pin: string;
  speakerCode?: string;
  studioSession?: string;
}

/**
 * `clientVersion` is a parameter, not a module constant: this directory is portable and must
 * not bake in a web build's version. An omitted `url` becomes '', which socket.io-client
 * resolves to same-origin.
 */
export function createSocket(opts: {
  clientType: 'web' | 'mobile';
  clientVersion: string;
  auth: SocketAuth;
  url?: string;
}): SocketClient {
  return io(opts.url ?? '', {
    path: '/api/socket.io',

    // A default deadline on every ack, so no call site can forget one. It also makes
    // Socket.IO reject pending acks on disconnect. Must stay above the server's
    // HANDLER_TIMEOUT_MS of 8s, so a wedged handler reports a real `timeout` ack.
    ackTimeout: 10_000,

    // Never add `retries`: it replays packets, and produce and connectTransport are not
    // idempotent. ackTimeout is independent of it.

    autoConnect: false,

    // Replayed verbatim on every reconnect, which is why the server re-establishes room
    // membership in its connect handler rather than assuming it sticks.
    auth: { clientType: opts.clientType, clientVersion: opts.clientVersion, ...opts.auth },
  }) as SocketClient;
}
