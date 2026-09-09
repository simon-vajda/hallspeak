import { describe, expect, it } from '@jest/globals';
import { PIN_PATTERN, SEMVER_PATTERN } from '@linguacast/contract/patterns';
import mobileManifest from '../../package.json';
import { CLIENT_VERSION } from '../version';
import { currentChannelStatus } from './status';

describe('currentChannelStatus', () => {
  it('seeds from the fetch before the socket has spoken', () => {
    expect(currentChannelStatus(undefined, false)?.online).toBe(false);
    expect(currentChannelStatus(undefined, true)?.online).toBe(true);
  });

  it('withholds when neither source has answered', () => {
    expect(currentChannelStatus(undefined, undefined)).toBeUndefined();
  });

  it('lets the socket turn a channel the fetch read as offline on air', () => {
    const status = currentChannelStatus({ online: true, muted: false }, false);

    expect(status?.online).toBe(true);
  });

  it('never lets the fetch regress a socket-authoritative reading', () => {
    const status = currentChannelStatus({ online: true, muted: false }, false);

    expect(status).toEqual({ online: true, muted: false });
  });

  it('keeps the last socket reading rather than falling back, so a drop is not offline', () => {
    const held = { online: true, muted: false };

    expect(currentChannelStatus(held, false)).toBe(held);
  });

  it('reports mute as unknown for an online channel the fetch alone has read', () => {
    expect(currentChannelStatus(undefined, true)?.muted).toBe(null);
  });
});

describe('mobile version', () => {
  it('uses the canonical mobile artifact version in the handshake', () => {
    expect(CLIENT_VERSION).toBe(mobileManifest.version);
  });

  it('satisfies the handshake schema, which rejects anything else outright', () => {
    expect(SEMVER_PATTERN.test(CLIENT_VERSION)).toBe(true);
    // Guards the import above against a pattern module that lost its PIN rule.
    expect(PIN_PATTERN.test('834912')).toBe(true);
  });
});
