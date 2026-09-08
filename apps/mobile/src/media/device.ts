import type { Signalling } from '@linguacast/client-core/media';
import { Device } from 'mediasoup-client';
import type { BuiltinHandlerName } from 'mediasoup-client/types';

/**
 * Named rather than detected: mediasoup-client's own detection reads a browser user agent
 * and does not reliably identify React Native. The annotation is the check — the name
 * changed across the library's 3.13 line, and a stale one fails at runtime with no compile
 * error, so `pnpm typecheck` is what catches a release that renamed it.
 */
export const HANDLER_NAME: BuiltinHandlerName = 'ReactNative106';

/**
 * One `Device` per socket connection. It is loaded from the router's capabilities and is
 * void the moment those could have changed, which on this server means every connect —
 * nothing about the media is persisted across one.
 */
export async function loadDevice(
  api: Signalling,
): Promise<{ device: Device; iceServers: RTCIceServer[] }> {
  const { routerRtpCapabilities, iceServers } = await api.capabilities();
  const device = new Device({ handlerName: HANDLER_NAME });
  await device.load({ routerRtpCapabilities });
  return { device, iceServers: iceServers as RTCIceServer[] };
}
