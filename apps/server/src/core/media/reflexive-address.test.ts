import { createSocket, type Socket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverReflexiveAddress, parseStunUrl, reflexiveMismatch } from './reflexive-address';

const MAGIC_COOKIE = 0x2112a442;

const sockets: Socket[] = [];

afterEach(async () => {
  await Promise.all(
    sockets.splice(0).map(
      (socket) =>
        new Promise<void>((resolve) => {
          socket.close(() => resolve());
        }),
    ),
  );
});

/**
 * A real responder on loopback rather than a mocked socket: the parsing is the part worth
 * testing, and a fake that produces the bytes by the same logic that reads them would
 * assert nothing.
 */
async function stunServer(
  reply: (transactionId: Buffer) => Buffer | null,
): Promise<{ url: string }> {
  const socket = createSocket('udp4');
  sockets.push(socket);
  socket.on('message', (message, from) => {
    const response = reply(message.subarray(8, 20));
    if (response) {
      socket.send(response, from.port, from.address);
    }
  });
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  return { url: `stun:127.0.0.1:${socket.address().port}` };
}

function attribute(type: number, value: Buffer): Buffer {
  const padding = (4 - (value.length % 4)) % 4;
  const attr = Buffer.alloc(4 + value.length + padding);
  attr.writeUInt16BE(type, 0);
  attr.writeUInt16BE(value.length, 2);
  value.copy(attr, 4);
  return attr;
}

function success(transactionId: Buffer, attributes: Buffer): Buffer {
  const message = Buffer.alloc(20 + attributes.length);
  message.writeUInt16BE(0x0101, 0);
  message.writeUInt16BE(attributes.length, 2);
  message.writeUInt32BE(MAGIC_COOKIE, 4);
  transactionId.copy(message, 8);
  attributes.copy(message, 20);
  return message;
}

function xorMapped(address: string, port = 54321): Buffer {
  const value = Buffer.alloc(8);
  value.writeUInt8(0, 0);
  value.writeUInt8(0x01, 1);
  value.writeUInt16BE(port ^ (MAGIC_COOKIE >>> 16), 2);
  const octets = address.split('.').map(Number);
  const packed =
    (((octets[0] ?? 0) << 24) |
      ((octets[1] ?? 0) << 16) |
      ((octets[2] ?? 0) << 8) |
      (octets[3] ?? 0)) >>>
    0;
  value.writeUInt32BE((packed ^ MAGIC_COOKIE) >>> 0, 4);
  return value;
}

function plainMapped(address: string, port = 54321): Buffer {
  const value = Buffer.alloc(8);
  value.writeUInt8(0, 0);
  value.writeUInt8(0x01, 1);
  value.writeUInt16BE(port, 2);
  for (const [index, octet] of address.split('.').map(Number).entries()) {
    value.writeUInt8(octet ?? 0, 4 + index);
  }
  return value;
}

describe('parseStunUrl', () => {
  it('reads a host and port out of a STUN url', () => {
    expect(parseStunUrl('stun:stun.l.google.com:19302')).toEqual({
      host: 'stun.l.google.com',
      port: 19302,
    });
  });

  it('defaults the port and tolerates a missing scheme', () => {
    expect(parseStunUrl('stun.example.org')).toEqual({ host: 'stun.example.org', port: 3478 });
  });

  it('ignores transport parameters, which mean nothing to a binding request', () => {
    expect(parseStunUrl('stun:stun.example.org:3478?transport=udp')).toEqual({
      host: 'stun.example.org',
      port: 3478,
    });
  });

  /** TLS over TCP; a UDP datagram at that port is not a probe, it is noise. */
  it('declines a stuns url rather than speaking UDP at a TLS port', () => {
    expect(parseStunUrl('stuns:stun.example.org:5349')).toBeNull();
  });

  it('declines an empty or unparseable value', () => {
    expect(parseStunUrl('  ')).toBeNull();
    expect(parseStunUrl('stun:host:not-a-port')).toBeNull();
  });
});

describe('discoverReflexiveAddress', () => {
  it('reads the address out of an XOR-MAPPED-ADDRESS attribute', async () => {
    const { url } = await stunServer((id) =>
      success(id, attribute(0x0020, xorMapped('203.0.113.10'))),
    );

    expect(await discoverReflexiveAddress(url)).toBe('203.0.113.10');
  });

  /** The RFC 3489 spelling; some deployments still answer with it and nothing else. */
  it('falls back to a plain MAPPED-ADDRESS when the XOR form is absent', async () => {
    const { url } = await stunServer((id) =>
      success(id, attribute(0x0001, plainMapped('198.51.100.7'))),
    );

    expect(await discoverReflexiveAddress(url)).toBe('198.51.100.7');
  });

  it('prefers the XOR form when a server sends both', async () => {
    const { url } = await stunServer((id) =>
      success(
        id,
        Buffer.concat([
          attribute(0x0001, plainMapped('198.51.100.7')),
          attribute(0x0020, xorMapped('203.0.113.10')),
        ]),
      ),
    );

    expect(await discoverReflexiveAddress(url)).toBe('203.0.113.10');
  });

  it('walks past a padded attribute it does not understand', async () => {
    const { url } = await stunServer((id) =>
      success(
        id,
        Buffer.concat([
          attribute(0x8022, Buffer.from('a test server')),
          attribute(0x0020, xorMapped('203.0.113.10')),
        ]),
      ),
    );

    expect(await discoverReflexiveAddress(url)).toBe('203.0.113.10');
  });

  /** An off-path datagram must not be able to answer for the server we asked. */
  it('ignores a reply carrying somebody else’s transaction id', async () => {
    const { url } = await stunServer(() =>
      success(Buffer.alloc(12, 0xab), attribute(0x0020, xorMapped('203.0.113.10'))),
    );

    expect(await discoverReflexiveAddress(url, { timeoutMs: 150 })).toBeNull();
  });

  it('gives up rather than hanging when nothing answers', async () => {
    const { url } = await stunServer(() => null);

    expect(await discoverReflexiveAddress(url, { timeoutMs: 150 })).toBeNull();
  });

  it('returns null for a url it cannot use, without sending anything', async () => {
    expect(await discoverReflexiveAddress('stuns:stun.example.org:5349')).toBeNull();
  });
});

describe('reflexiveMismatch', () => {
  it('says nothing when the two agree', () => {
    expect(reflexiveMismatch('203.0.113.10', '203.0.113.10')).toBeNull();
  });

  it('says nothing when the probe found nothing, because it decides nothing', () => {
    expect(reflexiveMismatch('203.0.113.10', null)).toBeNull();
  });

  /** Only reached with MEDIA_ANNOUNCE_HOSTNAME on; comparing a name to an address is noise. */
  it('says nothing about an announced hostname', () => {
    expect(reflexiveMismatch('home.example.org', '203.0.113.10')).toBeNull();
  });

  it('names both addresses and stays a warning, since the two may differ legitimately', () => {
    const message = reflexiveMismatch('203.0.113.10', '198.51.100.7');

    expect(message).toContain('203.0.113.10');
    expect(message).toContain('198.51.100.7');
    expect(message).toContain('MEDIA_ANNOUNCED_IP');
  });
});
