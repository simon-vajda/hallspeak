import type {
  ClientToServerEvents,
  clientToServer,
  ServerToClientEvents,
  serverToClient,
} from '@hallspeak/contract/socket';
import type { Server, Socket } from 'socket.io';
import type { SocketAuth } from '../../core/access';

export type C2S = ClientToServerEvents<typeof clientToServer>;
export type S2C = ServerToClientEvents<typeof serverToClient>;
export type ServerSideEvents = Record<string, never>;

// The fourth generic types socket.data, which the handshake gate fills in.
export type SocketServer = Server<C2S, S2C, ServerSideEvents, SocketAuth>;
export type ConnectedSocket = Socket<C2S, S2C, ServerSideEvents, SocketAuth>;
