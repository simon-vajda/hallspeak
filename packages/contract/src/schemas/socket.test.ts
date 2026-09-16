import { describe, expect, it } from 'vitest';
import {
  ChannelJoinResponse,
  ChannelListenerHistory,
  ChannelStatus,
  HandoverActionPayload,
  HandoverState,
  Handshake,
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
  MediaRestartIcePayload,
  MediaRestartIceResponse,
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

  it('carries fresh ICE parameters for an owned transport restart', () => {
    expect(MediaRestartIcePayload.parse({ transportId: 't1' })).toEqual({ transportId: 't1' });
    expect(MediaRestartIcePayload.safeParse({}).success).toBe(false);
    expect(
      MediaRestartIceResponse.parse({
        iceParameters: { usernameFragment: 'fresh', password: 'secret', iceLite: true },
      }),
    ).toEqual({
      iceParameters: { usernameFragment: 'fresh', password: 'secret', iceLite: true },
    });
  });

  it('requires initial paused intent on a produce payload and rejects a non-audio kind', () => {
    const valid = { slug: 'english', kind: 'audio', rtpParameters: opaque, paused: true };
    expect(MediaProducePayload.parse(valid)).toEqual(valid);
    expect(MediaProducePayload.safeParse({ ...valid, kind: 'video' }).success).toBe(false);
    expect(MediaProducePayload.safeParse({ ...valid, paused: undefined }).success).toBe(false);
    expect(MediaProducePayload.safeParse({ slug: 'english', kind: 'audio' }).success).toBe(false);
  });

  it('requires online and muted together in channel status payloads', () => {
    expect(
      ChannelJoinResponse.parse({
        online: true,
        muted: true,
        producerId: 'p1',
        incomingProducerId: null,
      }),
    ).toEqual({ online: true, muted: true, producerId: 'p1', incomingProducerId: null });
    expect(
      ChannelStatus.parse({
        slug: 'english',
        online: true,
        muted: false,
        producerId: 'p1',
        incomingProducerId: null,
      }),
    ).toEqual({
      slug: 'english',
      online: true,
      muted: false,
      producerId: 'p1',
      incomingProducerId: null,
    });
    expect(ChannelJoinResponse.safeParse({ online: true }).success).toBe(false);
    expect(ChannelJoinResponse.safeParse({ online: true, muted: true }).success).toBe(false);
    expect(ChannelStatus.safeParse({ slug: 'english', online: true }).success).toBe(false);
    expect(ChannelStatus.safeParse({ slug: 'english', online: true, muted: false }).success).toBe(
      false,
    );
  });

  it('carries a close reason only on channel status payloads', () => {
    const offline = {
      slug: 'english',
      online: false,
      muted: false,
      producerId: null,
      incomingProducerId: null,
    };
    expect(ChannelStatus.parse({ ...offline, reason: 'ended' })).toEqual({
      ...offline,
      reason: 'ended',
    });
    expect(ChannelStatus.parse({ ...offline, reason: 'dropped' })).toEqual({
      ...offline,
      reason: 'dropped',
    });
    expect(ChannelStatus.safeParse({ ...offline, reason: 'unknown' }).success).toBe(false);
    expect(
      ChannelJoinResponse.parse({
        online: false,
        muted: false,
        producerId: null,
        incomingProducerId: null,
        reason: 'ended',
      }),
    ).toEqual({ online: false, muted: false, producerId: null, incomingProducerId: null });
  });

  it('carries the current producer and, inside a swap window, the incoming one', () => {
    const base = { slug: 'english', online: true, muted: false };
    expect(ChannelStatus.parse({ ...base, producerId: 'p1', incomingProducerId: 'p2' })).toEqual({
      ...base,
      producerId: 'p1',
      incomingProducerId: 'p2',
    });
    expect(
      ChannelStatus.parse({
        slug: 'english',
        online: false,
        muted: false,
        producerId: null,
        incomingProducerId: null,
      }).producerId,
    ).toBeNull();
    expect(
      ChannelStatus.safeParse({ ...base, producerId: '', incomingProducerId: null }).success,
    ).toBe(false);
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

  it('accepts capabilities with no ICE servers, which is a deployment without STUN', () => {
    const parsed = MediaCapabilitiesResponse.parse({
      routerRtpCapabilities: opaque,
      iceServers: [],
    });
    expect(parsed.iceServers).toEqual([]);
  });

  it('accepts a STUN server, carries no credentials, and rejects an entry with no urls', () => {
    const parsed = MediaCapabilitiesResponse.parse({
      routerRtpCapabilities: opaque,
      iceServers: [{ urls: ['stun:example.org:3478'], username: 'u', credential: 'c' }],
    });
    expect(parsed.iceServers).toEqual([{ urls: ['stun:example.org:3478'] }]);
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

describe('handshake studio sessions', () => {
  const listener = { clientType: 'web', clientVersion: '1.2.3', pin: '123456' };

  it('defaults a listener handshake and leaves it without a studio session', () => {
    const parsed = Handshake.parse({ clientVersion: '1.2.3', pin: '123456' });
    expect(parsed.clientType).toBe('web');
    expect(parsed.studioSession).toBeUndefined();
  });

  it('accepts a speaker handshake carrying a studio session', () => {
    const parsed = Handshake.parse({
      ...listener,
      speakerCode: 'sp-code',
      studioSession: 'studio-session-1',
    });
    expect(parsed.studioSession).toBe('studio-session-1');
  });

  it('rejects a speaker code with no studio session, and a studio session with no code', () => {
    expect(Handshake.safeParse({ ...listener, speakerCode: 'sp-code' }).success).toBe(false);
    expect(Handshake.safeParse({ ...listener, studioSession: 'studio-session-1' }).success).toBe(
      false,
    );
  });

  it('bounds the studio session', () => {
    expect(
      Handshake.safeParse({ ...listener, speakerCode: 'sp-code', studioSession: 'short' }).success,
    ).toBe(false);
    expect(
      Handshake.safeParse({
        ...listener,
        speakerCode: 'sp-code',
        studioSession: 'x'.repeat(65),
      }).success,
    ).toBe(false);
  });
});

describe('handover schemas', () => {
  it('rejects any payload on a handover verb, so nothing can name another studio', () => {
    expect(HandoverActionPayload.parse({})).toEqual({});
    expect(HandoverActionPayload.safeParse({ channelId: 7 }).success).toBe(false);
    expect(HandoverActionPayload.safeParse({ studioSession: 'other' }).success).toBe(false);
  });

  it('carries a remaining duration only while one is running', () => {
    const waiting = HandoverState.parse({
      slug: 'english',
      holder: 'other',
      role: 'waiting',
      pending: true,
      remainingMs: 30_000,
      canTakeOver: false,
      onAirMs: 125_000,
    });
    expect(waiting.remainingMs).toBe(30_000);
    expect(
      HandoverState.parse({
        slug: 'english',
        holder: 'none',
        role: 'bystander',
        pending: false,
        remainingMs: null,
        canTakeOver: false,
        onAirMs: null,
      }).remainingMs,
    ).toBeNull();
  });

  it('rejects an unknown holder or role and a negative remaining duration', () => {
    const base = {
      slug: 'english',
      holder: 'self',
      role: 'live',
      pending: false,
      remainingMs: null,
      canTakeOver: false,
      onAirMs: 0,
    };
    expect(HandoverState.parse(base).role).toBe('live');
    expect(HandoverState.safeParse({ ...base, holder: 'someone' }).success).toBe(false);
    expect(HandoverState.safeParse({ ...base, role: 'declining' }).success).toBe(false);
    expect(HandoverState.safeParse({ ...base, remainingMs: -1 }).success).toBe(false);
  });
});

describe('listener history schema', () => {
  it('accepts ordered points and an empty series', () => {
    const parsed = ChannelListenerHistory.parse({
      slug: 'english',
      points: [
        { count: 0, ageMs: 600_000 },
        { count: 3, ageMs: 0 },
      ],
    });
    expect(parsed.points.map((point) => point.count)).toEqual([0, 3]);
    expect(ChannelListenerHistory.parse({ slug: 'english', points: [] }).points).toEqual([]);
  });

  it('rejects a negative count or age', () => {
    expect(
      ChannelListenerHistory.safeParse({ slug: 'english', points: [{ count: -1, ageMs: 0 }] })
        .success,
    ).toBe(false);
    expect(
      ChannelListenerHistory.safeParse({ slug: 'english', points: [{ count: 1, ageMs: -1 }] })
        .success,
    ).toBe(false);
  });
});
