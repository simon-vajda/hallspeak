import type { Signalling } from '@hallspeak/client-core/media';
import type { Device, types } from 'mediasoup-client';
import { logIceRecovery, watchTransport } from './diagnostics';

/**
 * Creates a receive transport and wires the one callback it exists for: `connect` carries
 * the DTLS parameters to the server, which is how mediasoup-client asks its application to
 * do the signalling it cannot do itself. The `produce` branch the web client also carries
 * is absent rather than dead: this app has no microphone path at all.
 *
 * The server's answer is authoritative and the ICE servers come with it, so nothing about
 * the network configuration is carried in this bundle.
 */
export async function openTransport(input: {
  api: Signalling;
  device: Device;
  iceServers: RTCIceServer[];
  onCandidateAddressFamilyMismatch?: () => void;
}): Promise<types.Transport> {
  const params = await input.api.createTransport('recv');
  const options = { ...params, iceServers: input.iceServers };
  // Serialized whole: the wire type is opaque here, and mediasoup has spelled the address
  // field two ways across versions, so naming fields would risk printing `undefined`.
  logIceRecovery(`server offered ${JSON.stringify(params.iceCandidates)}`);

  const transport = input.device.createRecvTransport(options);

  watchTransport(transport, params.iceCandidates, input.onCandidateAddressFamilyMismatch);

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    input.api
      .connectTransport(transport.id, dtlsParameters)
      .then(() => callback())
      .catch(errback);
  });

  return transport;
}
