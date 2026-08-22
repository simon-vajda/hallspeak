import { createHmac } from 'node:crypto';
import type { types } from 'mediasoup';

/**
 * Opus only, mono, in-band FEC. One speech source needs no stereo, and FEC recovers a
 * lost packet from the next one without adding latency — which is what venue Wi-Fi costs
 * and what the product's latency requirement cannot pay twice.
 *
 * `channels` is 2 because mediasoup supports Opus at 48000/2 and nothing else; mono is
 * negotiated through the stereo parameters instead. Setting `channels: 1` here is
 * rejected outright at router creation.
 */
export const AUDIO_CODECS: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    // The static payload type every browser already uses for Opus.
    preferredPayloadType: 111,
    clockRate: 48000,
    channels: 2,
    parameters: { useinbandfec: 1, stereo: 0, 'sprop-stereo': 0 },
  },
];

/**
 * How long a room with no producers and no transports survives before its router is
 * closed. Shorter re-creates the router — and renegotiates every attached guest — during
 * an ordinary handover between interpreters; longer holds worker resources on hardware
 * this deployment shape assumes is modest.
 */
export const ROOM_IDLE_GRACE_MS = 60_000;

export interface MediaNetworkConfig {
  listenIp: string;
  announcedIp: string;
  rtcPortBase: number;
  maxWorkers: number;
}

export interface TurnConfig {
  stunUrl?: string;
  turnUrl?: string;
  turnSecret?: string;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * One shared port per worker, on UDP and TCP alike. Ports scale with worker count rather
 * than audience size, so the hosting guide can name a fixed number. TCP is what keeps an
 * institutional network that blocks UDP working at all.
 */
export function listenInfosFor(
  net: MediaNetworkConfig,
  index: number,
): types.TransportListenInfo[] {
  const port = net.rtcPortBase + index;
  return (['udp', 'tcp'] as const).map((protocol) => ({
    protocol,
    ip: net.listenIp,
    announcedAddress: net.announcedIp,
    port,
  }));
}

/**
 * A worker earns its keep only when another concurrent event exists, so the maximum means
 * "simultaneous events given their own process"; the floor against core count stops
 * workers contending. Under Docker the floor is weaker than it looks — `os.cpus()` reports
 * the host's cores, not a cgroup quota — which is why startup logs both numbers.
 */
export function workerCountFor(hostCpuCount: number, maxWorkers: number): number {
  return Math.max(1, Math.min(hostCpuCount, maxWorkers));
}

export interface SessionCredential {
  username: string;
  credential: string;
}

/**
 * coturn's standard time-limited scheme: the username is an expiry timestamp and the
 * credential is its HMAC under the shared secret. Every guest is unauthenticated by
 * design, so a standing credential handed to all of them is a durable open relay.
 */
export function mintTurnCredential(secret: string, ttlSeconds: number, now = Date.now()) {
  const expiry = Math.floor(now / 1000) + ttlSeconds;
  const username = String(expiry);
  return {
    username,
    credential: createHmac('sha1', secret).update(username).digest('base64'),
  };
}

/**
 * The ICE configuration the server hands a client during signalling; the client never
 * carries any of it. Empty is valid and is exactly what a deployment without coturn
 * returns — ordinary networks connect on the direct path alone.
 */
export function iceServersFor(
  turn: TurnConfig,
  mint: (secret: string) => SessionCredential,
): IceServer[] {
  const servers: IceServer[] = [];
  if (turn.stunUrl) {
    servers.push({ urls: [turn.stunUrl] });
  }
  // A TURN url without a secret would have to be offered uncredentialed, which is an
  // open relay rather than a degraded one. Dropping it is the safe reading.
  if (turn.turnUrl && turn.turnSecret) {
    servers.push({ urls: [turn.turnUrl], ...mint(turn.turnSecret) });
  }
  return servers;
}

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
];

/**
 * A stale or private announced address fails silently: the candidates are well-formed and
 * unreachable, and nothing errors anywhere. Only judges literal IPv4 — a hostname is the
 * DDNS case and resolves somewhere this process cannot see.
 */
export function isUnroutableAnnouncedAddress(address: string): boolean {
  if (address === '::1') {
    return true;
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    return false;
  }
  return PRIVATE_V4.some((range) => range.test(address));
}
