import { describe, expect, it } from '@jest/globals';
import { ALL_SERVER_CHECK_COPY, serverCheck } from './server-check';

const FORBIDDEN = [
  'you are hearing',
  'you are listening',
  'is playing',
  'now playing',
  'listening now',
  'people are listening',
  'has been on air for',
];

const info = (serverVersion: string, minMobileVersion = '0.1.0') => ({
  serverVersion,
  minMobileVersion,
});

describe('server check copy', () => {
  it('claims nobody is hearing audio', () => {
    for (const line of ALL_SERVER_CHECK_COPY) {
      const lower = line.toLowerCase();

      for (const claim of FORBIDDEN) {
        expect(`${claim} in "${line}": ${lower.includes(claim)}`).toBe(
          `${claim} in "${line}": false`,
        );
      }
    }
  });

  it('renders nothing this module does not enumerate', () => {
    const rendered = new Set<string>();

    for (const input of [
      { info: undefined, failed: true },
      { info: info('0.3.0'), failed: false },
      { info: info('1.0.0'), failed: false },
      { info: info('0.4.0', '9.0.0'), failed: false },
      { info: info('edge'), failed: false },
    ]) {
      const check = serverCheck({ ...input, mobileVersion: '0.1.0' });
      if (check.state === 'blocked') {
        rendered.add(check.title);
        rendered.add(check.body);
      }
    }

    for (const line of rendered) {
      expect(ALL_SERVER_CHECK_COPY).toContain(line);
    }
    expect(rendered.size).toBe(ALL_SERVER_CHECK_COPY.length);
  });
});

describe('serverCheck', () => {
  it('waits while the first read is still in flight', () => {
    expect(serverCheck({ info: undefined, failed: false, mobileVersion: '0.1.0' })).toEqual({
      state: 'checking',
    });
  });

  it('offers a retry only for a read that never landed', () => {
    const unreachable = serverCheck({ info: undefined, failed: true, mobileVersion: '0.1.0' });
    expect(unreachable).toMatchObject({ state: 'blocked', retryable: true });

    const stale = serverCheck({ info: info('0.3.0'), failed: false, mobileVersion: '0.1.0' });
    expect(stale).toMatchObject({ state: 'blocked', retryable: false });
  });

  it('keeps a server it has already read as ready when a later read fails', () => {
    expect(serverCheck({ info: info('0.4.0'), failed: true, mobileVersion: '0.1.0' })).toEqual({
      state: 'ready',
    });
  });

  it('tells a guest to update the app for both halves they can act on', () => {
    const old = serverCheck({
      info: info('0.4.0', '9.0.0'),
      failed: false,
      mobileVersion: '0.1.0',
    });
    const future = serverCheck({ info: info('1.0.0'), failed: false, mobileVersion: '0.1.0' });

    expect(old).toEqual(future);
  });
});
