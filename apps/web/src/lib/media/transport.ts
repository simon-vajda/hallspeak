import type { Signalling } from '@linguacast/client-core/media';
import type { Device, types } from 'mediasoup-client';
import { logIceRecovery, watchTransport } from './diagnostics';

/**
 * Creates a transport and wires the two callbacks it exists for: `connect` carries the
 * DTLS parameters to the server, and `produce` — send side only — exchanges the RTP
 * parameters for a producer id. Both are how mediasoup-client asks its application to do
 * the signalling it cannot do itself.
 *
 * The server's answer is authoritative and the ICE servers come with it, so nothing about
 * the network configuration is carried in this bundle.
 */
export async function openTransport(input: {
  api: Signalling;
  device: Device;
  direction: 'send' | 'recv';
  iceServers: RTCIceServer[];
  /** Names the channel a produce belongs to; the send side needs it, the receive side does not. */
  slug?: string;
  onCandidateAddressFamilyMismatch?: () => void;
}): Promise<types.Transport> {
  const params = await input.api.createTransport(input.direction);
  const options = { ...params, iceServers: input.iceServers };
  // Serialized whole: the wire type is opaque here, and mediasoup has spelled the address
  // field two ways across versions, so naming fields would risk printing `undefined`.
  logIceRecovery(input.direction, `server offered ${JSON.stringify(params.iceCandidates)}`);

  const transport =
    input.direction === 'send'
      ? input.device.createSendTransport(options)
      : input.device.createRecvTransport(options);

  watchTransport(
    transport,
    input.direction,
    params.iceCandidates,
    input.onCandidateAddressFamilyMismatch,
  );

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    input.api
      .connectTransport(transport.id, dtlsParameters)
      .then(() => callback())
      .catch(errback);
  });

  if (input.direction === 'send') {
    transport.on('produce', ({ rtpParameters, appData }, callback, errback) => {
      const slug = input.slug;
      if (slug === undefined) {
        errback(new Error('A send transport needs the channel it produces on.'));
        return;
      }
      input.api
        .produce(slug, rtpParameters, appData.paused === true)
        .then(({ producerId }) => callback({ id: producerId }))
        .catch(errback);
    });
  }

  return transport;
}
