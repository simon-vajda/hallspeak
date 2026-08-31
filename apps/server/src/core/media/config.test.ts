import type { types } from 'mediasoup';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_CODECS,
  augmentCandidates,
  iceServersFor,
  isUnroutableAnnouncedAddress,
  listenInfosFor,
  mintTurnCredential,
  ROOM_IDLE_GRACE_MS,
  workerCountFor,
} from './config';

const net = {
  listenIp: '0.0.0.0',
  announcedIp: '203.0.113.10',
  rtcPortBase: 44400,
  maxWorkers: 4,
};

describe('listenInfosFor', () => {
  it('puts worker n on port base + n', () => {
    expect(listenInfosFor(net, 0).every((info) => info.port === 44400)).toBe(true);
    expect(listenInfosFor(net, 3).every((info) => info.port === 44403)).toBe(true);
  });

  it('listens on both UDP and TCP at that one port, so a venue blocking UDP still connects', () => {
    const protocols = listenInfosFor(net, 1).map((info) => info.protocol);
    expect(protocols).toEqual(['udp', 'tcp']);
    expect(new Set(listenInfosFor(net, 1).map((info) => info.port)).size).toBe(1);
  });

  it('carries the listen and announced addresses onto every entry', () => {
    for (const info of listenInfosFor(net, 0)) {
      expect(info.ip).toBe('0.0.0.0');
      expect(info.announcedAddress).toBe('203.0.113.10');
    }
  });
});

describe('augmentCandidates', () => {
  const hostname = (): types.IceCandidate[] => [
    {
      foundation: 'udpcandidate',
      priority: 1076302079,
      ip: 'media.example.org',
      address: 'media.example.org',
      protocol: 'udp',
      port: 44400,
      type: 'host',
    },
    {
      foundation: 'tcpcandidate',
      priority: 1076302078,
      ip: 'media.example.org',
      address: 'media.example.org',
      protocol: 'tcp',
      port: 44400,
      type: 'host',
      tcpType: 'passive',
    },
  ];

  it('offers both address forms, so Firefox and an IPv6-only carrier each find one', () => {
    const candidates = augmentCandidates(hostname(), '203.0.113.7');
    expect(candidates).toHaveLength(4);
    expect(candidates.map((candidate) => candidate.address)).toEqual([
      'media.example.org',
      'media.example.org',
      '203.0.113.7',
      '203.0.113.7',
    ]);
  });

  it('carries the source protocol and TCP type onto its twin', () => {
    const [, , udp, tcp] = augmentCandidates(hostname(), '203.0.113.7');
    expect(udp?.protocol).toBe('udp');
    expect(udp?.tcpType).toBeUndefined();
    expect(tcp?.protocol).toBe('tcp');
    expect(tcp?.tcpType).toBe('passive');
  });

  it('names the port the worker actually bound', () => {
    for (const candidate of augmentCandidates(hostname(), '203.0.113.7')) {
      expect(candidate.port).toBe(44400);
    }
  });

  it('sets both address and ip to the literal, which mediasoup carries separately', () => {
    for (const candidate of augmentCandidates(hostname(), '203.0.113.7').slice(2)) {
      expect(candidate.ip).toBe('203.0.113.7');
      expect(candidate.address).toBe('203.0.113.7');
    }
  });

  it('gives every appended candidate a foundation of its own', () => {
    const foundations = augmentCandidates(hostname(), '203.0.113.7').map((c) => c.foundation);
    expect(new Set(foundations).size).toBe(4);
  });

  it('ranks the literal above the name it was derived from', () => {
    const [udpName, tcpName, udpLiteral, tcpLiteral] = augmentCandidates(
      hostname(),
      '203.0.113.7',
    );
    expect(udpLiteral?.priority).toBeGreaterThan(udpName?.priority ?? 0);
    expect(tcpLiteral?.priority).toBeGreaterThan(tcpName?.priority ?? 0);
  });

  it('returns a literal-announcing list unchanged rather than duplicating it', () => {
    const literal = hostname().map((candidate) => ({
      ...candidate,
      ip: '203.0.113.7',
      address: '203.0.113.7',
    }));
    expect(augmentCandidates(literal, '203.0.113.7')).toEqual(literal);
  });

  it('returns an empty list rather than throwing', () => {
    expect(augmentCandidates([], '203.0.113.7')).toEqual([]);
  });
});

describe('workerCountFor', () => {
  it('takes the smaller of the host core count and the configured maximum', () => {
    expect(workerCountFor(8, 4)).toBe(4);
    expect(workerCountFor(2, 4)).toBe(2);
  });

  it('never drops below one, whatever the host reports', () => {
    expect(workerCountFor(0, 4)).toBe(1);
  });
});

describe('AUDIO_CODECS', () => {
  it('is exactly one Opus entry with in-band FEC', () => {
    expect(AUDIO_CODECS).toHaveLength(1);
    const [opus] = AUDIO_CODECS;
    expect(opus?.mimeType).toBe('audio/opus');
    expect(opus?.clockRate).toBe(48000);
    expect(opus?.parameters?.useinbandfec).toBe(1);
  });

  it('negotiates mono through the stereo parameters, since mediasoup only takes 48000/2', () => {
    const [opus] = AUDIO_CODECS;
    expect(opus?.channels).toBe(2);
    expect(opus?.parameters?.stereo).toBe(0);
    expect(opus?.parameters?.['sprop-stereo']).toBe(0);
  });
});

describe('iceServersFor', () => {
  it('is empty when nothing is configured, which is a deployment without coturn', () => {
    expect(iceServersFor({}, () => ({ username: 'u', credential: 'c' }))).toEqual([]);
  });

  it('carries a STUN url with no credentials', () => {
    const servers = iceServersFor({ stunUrl: 'stun:stun.example.org:3478' }, () => ({
      username: 'u',
      credential: 'c',
    }));
    expect(servers).toEqual([{ urls: ['stun:stun.example.org:3478'] }]);
  });

  it('mints per-session credentials for a TURN url rather than echoing the shared secret', () => {
    const servers = iceServersFor(
      { turnUrl: 'turn:turn.example.org:3478', turnSecret: 'shared-secret' },
      () => ({ username: '1700000000:abc', credential: 'minted' }),
    );
    expect(servers).toEqual([
      { urls: ['turn:turn.example.org:3478'], username: '1700000000:abc', credential: 'minted' },
    ]);
    expect(JSON.stringify(servers)).not.toContain('shared-secret');
  });

  it('omits TURN when the url is set without a secret, rather than handing out an open relay', () => {
    expect(
      iceServersFor({ turnUrl: 'turn:turn.example.org:3478' }, () => ({
        username: 'u',
        credential: 'c',
      })),
    ).toEqual([]);
  });

  it('returns both entries when STUN and TURN are configured together', () => {
    const servers = iceServersFor(
      {
        stunUrl: 'stun:stun.example.org:3478',
        turnUrl: 'turn:turn.example.org:3478',
        turnSecret: 's',
      },
      () => ({ username: 'u', credential: 'c' }),
    );
    expect(servers).toHaveLength(2);
  });
});

describe('mintTurnCredential', () => {
  it('carries an expiry the given number of seconds out', () => {
    const now = 1_700_000_000_000;
    const { username } = mintTurnCredential('secret', 3600, now);
    expect(Number(username)).toBe(1_700_000_000 + 3600);
  });

  it('never returns the shared secret itself', () => {
    const minted = mintTurnCredential('shared-secret', 3600, 1_700_000_000_000);
    expect(minted.credential).not.toContain('shared-secret');
    expect(minted.credential.length).toBeGreaterThan(0);
  });

  it('gives two sessions different credentials as the expiry moves', () => {
    const a = mintTurnCredential('secret', 3600, 1_700_000_000_000);
    const b = mintTurnCredential('secret', 3600, 1_700_000_060_000);
    expect(a.username).not.toBe(b.username);
    expect(a.credential).not.toBe(b.credential);
  });
});

describe('isUnroutableAnnouncedAddress', () => {
  it('flags loopback and private ranges, which produce candidates nobody can reach', () => {
    expect(isUnroutableAnnouncedAddress('127.0.0.1')).toBe(true);
    expect(isUnroutableAnnouncedAddress('192.168.1.20')).toBe(true);
    expect(isUnroutableAnnouncedAddress('10.0.0.5')).toBe(true);
    expect(isUnroutableAnnouncedAddress('172.16.0.1')).toBe(true);
    expect(isUnroutableAnnouncedAddress('172.31.255.254')).toBe(true);
  });

  it('does not flag a public address or one just outside the private ranges', () => {
    expect(isUnroutableAnnouncedAddress('203.0.113.10')).toBe(false);
    expect(isUnroutableAnnouncedAddress('172.32.0.1')).toBe(false);
    expect(isUnroutableAnnouncedAddress('11.0.0.1')).toBe(false);
  });

  it('does not flag a hostname, which is the DDNS case and cannot be judged here', () => {
    expect(isUnroutableAnnouncedAddress('linguacast.example.org')).toBe(false);
  });
});

describe('ROOM_IDLE_GRACE_MS', () => {
  it('is long enough to survive an ordinary handover between interpreters', () => {
    expect(ROOM_IDLE_GRACE_MS).toBeGreaterThanOrEqual(30_000);
    expect(ROOM_IDLE_GRACE_MS).toBeLessThanOrEqual(300_000);
  });
});
