import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env';

describe('EnvSchema media configuration', () => {
  it('requires an announced address in production', () => {
    const result = EnvSchema.safeParse({ NODE_ENV: 'production' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['PUBLIC_ADDRESS']);
  });

  it('accepts the same configuration in development, falling back to loopback', () => {
    const result = EnvSchema.parse({ NODE_ENV: 'development' });
    expect(result.PUBLIC_ADDRESS).toBe('127.0.0.1');
  });

  it('keeps a configured announced address in production', () => {
    const result = EnvSchema.parse({
      NODE_ENV: 'production',
      PUBLIC_ADDRESS: '203.0.113.10',
    });
    expect(result.PUBLIC_ADDRESS).toBe('203.0.113.10');
  });

  it('defaults the port base and worker maximum', () => {
    const result = EnvSchema.parse({});
    expect(result.MEDIA_RTC_PORT_BASE).toBe(44400);
    expect(result.MEDIA_MAX_WORKERS).toBe(4);
  });

  it('rejects a malformed port base', () => {
    expect(EnvSchema.safeParse({ MEDIA_RTC_PORT_BASE: 'forty-four-thousand' }).success).toBe(false);
    expect(EnvSchema.safeParse({ MEDIA_RTC_PORT_BASE: '80' }).success).toBe(false);
    expect(EnvSchema.safeParse({ MEDIA_RTC_PORT_BASE: '70000' }).success).toBe(false);
  });

  it('ignores leftover TURN settings rather than refusing to start', () => {
    const result = EnvSchema.parse({
      MEDIA_TURN_URL: 'turn:turn.example.org:3478',
      MEDIA_TURN_SECRET: 'shared-secret',
    });
    expect(result).not.toHaveProperty('MEDIA_TURN_URL');
    expect(result).not.toHaveProperty('MEDIA_TURN_SECRET');
  });

  it('defaults STUN to a public server, since most deployments want one', () => {
    expect(EnvSchema.parse({}).MEDIA_STUN_URL).toBe('stun:stun.l.google.com:19302');
  });

  it('reads an empty MEDIA_STUN_URL as off, so the default can be declined', () => {
    expect(EnvSchema.parse({ MEDIA_STUN_URL: '' }).MEDIA_STUN_URL).toBeUndefined();
    expect(EnvSchema.parse({ MEDIA_STUN_URL: '   ' }).MEDIA_STUN_URL).toBeUndefined();
  });
});

describe('EnvSchema logging', () => {
  it('defaults to the level that diagnoses a ticket without narration', () => {
    expect(EnvSchema.parse({}).LOG_LEVEL).toBe('info');
  });

  it('accepts every level the logger understands', () => {
    for (const value of ['error', 'warn', 'info', 'debug', 'trace']) {
      expect(EnvSchema.parse({ LOG_LEVEL: value }).LOG_LEVEL).toBe(value);
    }
  });

  it('refuses an unknown level rather than falling back to one', () => {
    const result = EnvSchema.safeParse({ LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['LOG_LEVEL']);
  });

  it('writes the retained copy under the data directory by default', () => {
    expect(EnvSchema.parse({}).LOG_DIR).toBe(path.join('./data', 'logs'));
    expect(EnvSchema.parse({ DATA_DIR: '/srv/linguacast/data' }).LOG_DIR).toBe(
      path.join('/srv/linguacast/data', 'logs'),
    );
  });

  it('takes a configured log directory verbatim', () => {
    expect(EnvSchema.parse({ LOG_DIR: '/var/log/linguacast' }).LOG_DIR).toBe('/var/log/linguacast');
  });

  it('reads an empty log directory as file logging declined', () => {
    expect(EnvSchema.parse({ LOG_DIR: '' }).LOG_DIR).toBe('');
    expect(EnvSchema.parse({ LOG_DIR: '   ' }).LOG_DIR).toBe('');
  });
});

describe('EnvSchema data directory', () => {
  it('defaults to ./data, holding both the database and the credential file', () => {
    expect(EnvSchema.parse({}).DATA_DIR).toBe('./data');
  });

  it('takes a configured directory verbatim', () => {
    expect(EnvSchema.parse({ DATA_DIR: '/srv/linguacast/data' }).DATA_DIR).toBe(
      '/srv/linguacast/data',
    );
  });
});
