import { describe, expect, it } from 'vitest';
import {
  AUDIO_CODECS,
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
  it('is exactly one Opus entry, mono, with in-band FEC', () => {
    expect(AUDIO_CODECS).toHaveLength(1);
    const [opus] = AUDIO_CODECS;
    expect(opus?.mimeType).toBe('audio/opus');
    expect(opus?.channels).toBe(1);
    expect(opus?.clockRate).toBe(48000);
    expect(opus?.parameters?.useinbandfec).toBe(1);
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
