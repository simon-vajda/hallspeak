import { describe, expect, it } from 'vitest';
import {
  MediaCapabilitiesResponse,
  MediaConnectTransportPayload,
  MediaConsumePayload,
  MediaConsumeResponse,
  MediaConsumerPayload,
  MediaCreateTransportPayload,
  MediaCreateTransportResponse,
  MediaProducePayload,
  MediaProducerPayload,
  MediaReset,
} from './socket';

const opaque = { codecs: [{ mimeType: 'audio/opus', channels: 1 }], headerExtensions: [] };

describe('media payload schemas', () => {
  it('accepts a create-transport payload and rejects an unknown direction', () => {
    expect(MediaCreateTransportPayload.parse({ direction: 'recv' })).toEqual({ direction: 'recv' });
    expect(MediaCreateTransportPayload.safeParse({ direction: 'both' }).success).toBe(false);
    expect(MediaCreateTransportPayload.safeParse({}).success).toBe(false);
  });

  it('accepts a connect-transport payload and rejects one missing the transport id', () => {
    expect(
      MediaConnectTransportPayload.parse({ transportId: 't1', dtlsParameters: opaque }),
    ).toEqual({ transportId: 't1', dtlsParameters: opaque });
    expect(MediaConnectTransportPayload.safeParse({ dtlsParameters: opaque }).success).toBe(false);
  });

  it('accepts a produce payload and rejects a non-audio kind', () => {
    const valid = { slug: 'english', kind: 'audio', rtpParameters: opaque };
    expect(MediaProducePayload.parse(valid)).toEqual(valid);
    expect(MediaProducePayload.safeParse({ ...valid, kind: 'video' }).success).toBe(false);
    expect(MediaProducePayload.safeParse({ slug: 'english', kind: 'audio' }).success).toBe(false);
  });

  it('accepts a consume payload and rejects one missing capabilities', () => {
    expect(MediaConsumePayload.parse({ slug: 'english', rtpCapabilities: opaque })).toEqual({
      slug: 'english',
      rtpCapabilities: opaque,
    });
    expect(MediaConsumePayload.safeParse({ slug: 'english' }).success).toBe(false);
  });

  it('accepts producer and consumer id payloads and rejects empty ids', () => {
    expect(MediaProducerPayload.parse({ producerId: 'p1' })).toEqual({ producerId: 'p1' });
    expect(MediaProducerPayload.safeParse({ producerId: '' }).success).toBe(false);
    expect(MediaConsumerPayload.parse({ consumerId: 'c1' })).toEqual({ consumerId: 'c1' });
    expect(MediaConsumerPayload.safeParse({}).success).toBe(false);
  });

  it('carries opaque mediasoup blobs through unstripped', () => {
    const parsed = MediaCreateTransportResponse.parse({
      id: 't1',
      iceParameters: { usernameFragment: 'u', password: 'p', iceLite: true },
      iceCandidates: [{ foundation: 'udpcandidate', protocol: 'udp', port: 44444 }],
      dtlsParameters: opaque,
    });
    expect(parsed.iceParameters).toEqual({ usernameFragment: 'u', password: 'p', iceLite: true });
    expect(parsed.iceCandidates[0]).toEqual({
      foundation: 'udpcandidate',
      protocol: 'udp',
      port: 44444,
    });
  });

  it('rejects a non-object where an opaque blob is required', () => {
    expect(MediaConsumePayload.safeParse({ slug: 'english', rtpCapabilities: 'x' }).success).toBe(
      false,
    );
  });

  it('accepts capabilities with no ICE servers, which is a deployment without coturn', () => {
    const parsed = MediaCapabilitiesResponse.parse({
      routerRtpCapabilities: opaque,
      iceServers: [],
    });
    expect(parsed.iceServers).toEqual([]);
  });

  it('accepts an ICE server with credentials and rejects one with no urls', () => {
    const parsed = MediaCapabilitiesResponse.parse({
      routerRtpCapabilities: opaque,
      iceServers: [{ urls: ['turn:example.org:3478'], username: 'u', credential: 'c' }],
    });
    expect(parsed.iceServers[0]?.username).toBe('u');
    expect(
      MediaCapabilitiesResponse.safeParse({ routerRtpCapabilities: opaque, iceServers: [{}] })
        .success,
    ).toBe(false);
  });

  it('accepts a consume response and rejects one missing the consumer id', () => {
    const valid = { consumerId: 'c1', producerId: 'p1', kind: 'audio', rtpParameters: opaque };
    expect(MediaConsumeResponse.parse(valid)).toEqual(valid);
    expect(MediaConsumeResponse.safeParse({ ...valid, consumerId: undefined }).success).toBe(false);
  });

  it('accepts a known reset reason and rejects an invented one', () => {
    expect(MediaReset.parse({ reason: 'worker_died' })).toEqual({ reason: 'worker_died' });
    expect(MediaReset.safeParse({ reason: 'because' }).success).toBe(false);
  });
});
