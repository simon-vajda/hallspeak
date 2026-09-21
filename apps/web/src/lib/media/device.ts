import type { Signalling } from '@hallspeak/client-core/media';
import { Device } from 'mediasoup-client';

/**
 * One `Device` per socket connection. It is loaded from the router's capabilities and is
 * void the moment those could have changed, which on this server means every connect —
 * nothing about the media is persisted across one.
 */
export async function loadDevice(
  api: Signalling,
): Promise<{ device: Device; iceServers: RTCIceServer[] }> {
  const { routerRtpCapabilities, iceServers } = await api.capabilities();
  const device = new Device();
  await device.load({ routerRtpCapabilities });
  return { device, iceServers: iceServers as RTCIceServer[] };
}
