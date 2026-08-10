import { describe, expect, it, vi } from 'vitest';
import { MIN_CLIENT_VERSION } from '../version';
import { handshakeGate, semverLt } from './handshake';

describe('semverLt', () => {
  it('is false for equal versions', () => {
    expect(semverLt('1.2.3', '1.2.3')).toBe(false);
  });

  it('compares across the major boundary', () => {
    expect(semverLt('0.9.9', '1.0.0')).toBe(true);
    expect(semverLt('1.0.0', '0.9.9')).toBe(false);
  });

  it('compares across the minor boundary', () => {
    expect(semverLt('1.1.9', '1.2.0')).toBe(true);
    expect(semverLt('1.2.0', '1.1.9')).toBe(false);
  });

  it('compares across the patch boundary', () => {
    expect(semverLt('1.2.3', '1.2.4')).toBe(true);
    expect(semverLt('1.2.4', '1.2.3')).toBe(false);
  });

  it('compares numerically, not lexically', () => {
    expect(semverLt('1.10.0', '1.9.0')).toBe(false);
    expect(semverLt('1.9.0', '1.10.0')).toBe(true);
  });
});

describe('handshakeGate', () => {
  const gate = (auth: unknown) => {
    const next = vi.fn();
    handshakeGate({ handshake: { auth } }, next);
    return next;
  };

  it('accepts a client at exactly MIN_CLIENT_VERSION', () => {
    expect(gate({ clientVersion: MIN_CLIENT_VERSION })).toHaveBeenCalledWith();
  });

  it('accepts a client newer than MIN_CLIENT_VERSION', () => {
    expect(gate({ clientVersion: '99.0.0' })).toHaveBeenCalledWith();
  });

  it('rejects an older client with client_too_old', () => {
    expect(gate({ clientVersion: '0.0.1' })).toHaveBeenCalledWith(new Error('client_too_old'));
  });

  it('rejects a malformed version with invalid_handshake', () => {
    expect(gate({ clientVersion: '1.2' })).toHaveBeenCalledWith(new Error('invalid_handshake'));
    expect(gate({ clientVersion: '1.2.3-beta.1' })).toHaveBeenCalledWith(
      new Error('invalid_handshake'),
    );
  });

  it('rejects a missing handshake with invalid_handshake', () => {
    expect(gate({})).toHaveBeenCalledWith(new Error('invalid_handshake'));
    expect(gate(undefined)).toHaveBeenCalledWith(new Error('invalid_handshake'));
  });
});
