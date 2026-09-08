import { unwrap } from '@linguacast/contract/socket';
import type { SocketClient } from '../socket/client';

/**
 * The socket calls the media layer makes, collapsed to plain promises. `unwrap` turns the
 * ack envelope into a value or a `SocketError`, so every caller here can use try/catch.
 *
 * mediasoup's capability, ICE, DTLS and RTP structures cross the wire as opaque objects —
 * the contract compiles with no DOM and cannot import mediasoup — so this is where they
 * become mediasoup-client's types again.
 */

// biome-ignore lint/suspicious/noExplicitAny: the wire side of the contract's opaque blobs.
type Wire = any;

export interface Signalling {
  capabilities(): Promise<{ routerRtpCapabilities: Wire; iceServers: Wire[] }>;
  createTransport(direction: 'send' | 'recv'): Promise<{
    id: string;
    iceParameters: Wire;
    iceCandidates: Wire[];
    dtlsParameters: Wire;
  }>;
  connectTransport(transportId: string, dtlsParameters: Wire): Promise<void>;
  restartIce(transportId: string): Promise<{ iceParameters: Wire }>;
  closeTransport(transportId: string): Promise<void>;
  produce(slug: string, rtpParameters: Wire, paused: boolean): Promise<{ producerId: string }>;
  pauseProducer(producerId: string): Promise<void>;
  resumeProducer(producerId: string): Promise<void>;
  closeProducer(producerId: string): Promise<void>;
  consume(
    slug: string,
    rtpCapabilities: Wire,
  ): Promise<{ consumerId: string; producerId: string; kind: 'audio'; rtpParameters: Wire }>;
  resumeConsumer(consumerId: string): Promise<void>;
  closeConsumer(consumerId: string): Promise<void>;
}

export function signalling(socket: SocketClient): Signalling {
  return {
    capabilities: async () => unwrap(await socket.emitWithAck('media:capabilities', {})),

    createTransport: async (direction) =>
      unwrap(await socket.emitWithAck('media:create-transport', { direction })),

    connectTransport: async (transportId, dtlsParameters) => {
      unwrap(await socket.emitWithAck('media:connect-transport', { transportId, dtlsParameters }));
    },

    restartIce: async (transportId) =>
      unwrap(await socket.emitWithAck('media:restart-ice', { transportId })),

    closeTransport: async (transportId) => {
      unwrap(await socket.emitWithAck('media:close-transport', { transportId }));
    },

    produce: async (slug, rtpParameters, paused) =>
      unwrap(
        await socket.emitWithAck('media:produce', {
          slug,
          kind: 'audio',
          rtpParameters,
          paused,
        }),
      ),

    pauseProducer: async (producerId) => {
      unwrap(await socket.emitWithAck('media:pause-producer', { producerId }));
    },

    resumeProducer: async (producerId) => {
      unwrap(await socket.emitWithAck('media:resume-producer', { producerId }));
    },

    closeProducer: async (producerId) => {
      unwrap(await socket.emitWithAck('media:close-producer', { producerId }));
    },

    consume: async (slug, rtpCapabilities) =>
      unwrap(await socket.emitWithAck('media:consume', { slug, rtpCapabilities })),

    resumeConsumer: async (consumerId) => {
      unwrap(await socket.emitWithAck('media:resume-consumer', { consumerId }));
    },

    closeConsumer: async (consumerId) => {
      unwrap(await socket.emitWithAck('media:close-consumer', { consumerId }));
    },
  };
}
