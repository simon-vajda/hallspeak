import { createSocket } from 'node:dgram';

/**
 * What the internet sees this server as, asked of a STUN server at boot.
 *
 * Nothing decides anything on this answer — it is compared against the announced address
 * and disagreement is logged. A resolved hostname pointing at the wrong place is the last
 * failure in this area that is still silent: the candidates are well-formed, the name
 * resolves, and no guest can connect. This turns that into a startup line.
 *
 * It is deliberately not a source of truth. The address a STUN binding request reports is
 * where *outbound* traffic exits, which is not necessarily where guests arrive — a
 * multi-WAN router, CGNAT, or a proxy on another host all make the two differ legitimately,
 * so a mismatch is a warning and never an error.
 */

/** Long enough for a round trip to a public STUN server, short enough to ignore. */
export const REFLEXIVE_PROBE_TIMEOUT_MS = 5_000;

const BINDING_REQUEST = 0x0001;
const BINDING_SUCCESS = 0x0101;
const MAGIC_COOKIE = 0x2112a442;
const XOR_MAPPED_ADDRESS = 0x0020;
const MAPPED_ADDRESS = 0x0001;
const HEADER_BYTES = 20;
const FAMILY_IPV4 = 0x01;

interface StunEndpoint {
  host: string;
  port: number;
}

/**
 * `stun:host:port`, `stun:host`, or a bare `host:port`. A `stuns:` URL is TLS over TCP,
 * which this probe does not speak — declining it is better than sending a UDP datagram at
 * a port expecting a handshake.
 */
export function parseStunUrl(url: string): StunEndpoint | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('stuns:')) {
    return null;
  }
  const withoutScheme = trimmed.startsWith('stun:') ? trimmed.slice('stun:'.length) : trimmed;
  // Query parameters are legal in a STUN URI (`?transport=`) and mean nothing here.
  const [authority] = withoutScheme.split('?');
  if (!authority) {
    return null;
  }
  const separator = authority.lastIndexOf(':');
  if (separator === -1) {
    return authority ? { host: authority, port: 3478 } : null;
  }
  const host = authority.slice(0, separator);
  const port = Number(authority.slice(separator + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return null;
  }
  return { host, port };
}

function buildBindingRequest(transactionId: Buffer): Buffer {
  const message = Buffer.alloc(HEADER_BYTES);
  message.writeUInt16BE(BINDING_REQUEST, 0);
  message.writeUInt16BE(0, 2);
  message.writeUInt32BE(MAGIC_COOKIE, 4);
  transactionId.copy(message, 8);
  return message;
}

/**
 * Walks the attribute TLVs for a mapped address. XOR-MAPPED-ADDRESS is preferred and is
 * what every current server sends; MAPPED-ADDRESS is the RFC 3489 spelling, still emitted
 * by some deployments, and is read only when the XOR form is absent.
 */
function readMappedAddress(message: Buffer, transactionId: Buffer): string | null {
  if (message.length < HEADER_BYTES || message.readUInt16BE(0) !== BINDING_SUCCESS) {
    return null;
  }
  if (message.readUInt32BE(4) !== MAGIC_COOKIE) {
    return null;
  }
  if (!message.subarray(8, HEADER_BYTES).equals(transactionId)) {
    return null;
  }

  const end = Math.min(message.length, HEADER_BYTES + message.readUInt16BE(2));
  let fallback: string | null = null;
  let offset = HEADER_BYTES;

  while (offset + 4 <= end) {
    const type = message.readUInt16BE(offset);
    const length = message.readUInt16BE(offset + 2);
    const value = message.subarray(offset + 4, offset + 4 + length);
    // Attributes are padded to a four-byte boundary; the padding is not in the length.
    offset += 4 + length + ((4 - (length % 4)) % 4);

    if (value.length < 8 || value[1] !== FAMILY_IPV4) {
      continue;
    }
    if (type === XOR_MAPPED_ADDRESS) {
      const address = value.readUInt32BE(4) ^ MAGIC_COOKIE;
      return [address >>> 24, (address >>> 16) & 0xff, (address >>> 8) & 0xff, address & 0xff].join(
        '.',
      );
    }
    if (type === MAPPED_ADDRESS && fallback === null) {
      fallback = [value[4], value[5], value[6], value[7]].join('.');
    }
  }

  return fallback;
}

export interface ReflexiveProbeOptions {
  timeoutMs?: number;
}

/**
 * One binding request, one answer, no retry: a probe whose only product is a log line is
 * not worth a retransmission schedule, and a STUN server that does not answer in five
 * seconds has already told us to move on. Resolves to null on every failure.
 *
 * The socket binds an ephemeral port rather than a worker's RTC port, which is held. Only
 * the address is ever compared for that reason — under endpoint-dependent mapping the
 * *port* would differ from a worker's while the public address still matches.
 */
export function discoverReflexiveAddress(
  stunUrl: string,
  options: ReflexiveProbeOptions = {},
): Promise<string | null> {
  const endpoint = parseStunUrl(stunUrl);
  if (!endpoint) {
    return Promise.resolve(null);
  }

  const timeoutMs = options.timeoutMs ?? REFLEXIVE_PROBE_TIMEOUT_MS;
  const transactionId = Buffer.alloc(12);
  for (let index = 0; index < transactionId.length; index += 1) {
    transactionId[index] = Math.floor(Math.random() * 256);
  }

  return new Promise<string | null>((resolve) => {
    const socket = createSocket('udp4');
    let settled = false;

    const finish = (address: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(address);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    timer.unref?.();

    socket.on('message', (message) => finish(readMappedAddress(message, transactionId)));
    socket.on('error', () => finish(null));
    socket.send(buildBindingRequest(transactionId), endpoint.port, endpoint.host, (err) => {
      if (err) {
        finish(null);
      }
    });
  });
}
