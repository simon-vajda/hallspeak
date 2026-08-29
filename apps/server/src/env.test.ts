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

  it('leaves TURN unset, which is a deployment without coturn', () => {
    const result = EnvSchema.parse({});
    expect(result.MEDIA_TURN_URL).toBeUndefined();
    expect(result.MEDIA_TURN_SECRET).toBeUndefined();
  });

  it('defaults STUN to a public server, since most deployments want one', () => {
    expect(EnvSchema.parse({}).MEDIA_STUN_URL).toBe('stun:stun.l.google.com:19302');
  });

  it('reads an empty MEDIA_STUN_URL as off, so the default can be declined', () => {
    expect(EnvSchema.parse({ MEDIA_STUN_URL: '' }).MEDIA_STUN_URL).toBeUndefined();
    expect(EnvSchema.parse({ MEDIA_STUN_URL: '   ' }).MEDIA_STUN_URL).toBeUndefined();
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
