import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'info', LOG_DIR: '' },
}));
vi.mock('../env', () => ({ env: envMock }));

const { logger, logTargets, prepareLogDirectory, resetOnceWarnings, useLogDestination } =
  await import('./log');

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let records: Record<string, unknown>[];

beforeEach(() => {
  resetOnceWarnings();
  records = [];
  useLogDestination({
    write(chunk: string) {
      records.push(JSON.parse(chunk));
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the level gate', () => {
  it('writes an info record and drops a debug one at the default level', () => {
    const log = logger('media');
    log.info({ slug: 'en' }, 'channel on air');
    log.debug({ slug: 'en' }, 'transport connecting');

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ msg: 'channel on air', slug: 'en' });
  });

  it('writes a debug record and drops a trace one at debug', () => {
    const log = logger('media');
    log.level = 'debug';
    log.debug({ slug: 'en' }, 'transport connecting');
    log.trace({ address: '198.51.100.7' }, 'candidate offered');

    expect(records.map((record) => record.msg)).toEqual(['transport connecting']);
  });

  it('writes a trace record at trace', () => {
    const log = logger('media');
    log.level = 'trace';
    log.trace({ address: '198.51.100.7' }, 'candidate offered');

    expect(records[0]).toMatchObject({ msg: 'candidate offered', address: '198.51.100.7' });
  });

  it('keeps every severity addressable', () => {
    const log = logger('media');
    log.info('informational');
    log.warn('a warning');
    log.error('an error');

    expect(records.map((record) => record.msg)).toEqual(['informational', 'a warning', 'an error']);
    expect(new Set(records.map((record) => record.level))).toEqual(new Set([30, 40, 50]));
  });
});

describe('the record shape', () => {
  it('carries the subsystem without the call site passing it', () => {
    logger('proxy').info('hello');

    expect(records[0]?.subsystem).toBe('proxy');
  });

  it('carries an ISO-8601 timestamp', () => {
    logger('proxy').info('hello');

    const time = String(records[0]?.time);
    expect(time).toMatch(ISO);
    expect(new Date(time).toISOString()).toBe(time);
  });

  it('serializes an error and its stack as one line', () => {
    logger('media').error(
      { err: new Error('boom', { cause: new Error('underlying') }) },
      'could not start',
    );

    const err = records[0]?.err as { stack: string; message: string };
    expect(err.message).toContain('boom');
    expect(err.stack).toContain('Error: boom');
    // The whole record is one line, so a reader taking the last N lines of the file gets
    // the whole trace rather than its tail.
    expect(JSON.stringify(records[0])).not.toContain('\n');
  });
});

describe('redaction', () => {
  it('censors every secret spelling passed as a field', () => {
    const log = logger('socket');
    log.info(
      {
        pin: '123456',
        speakerCode: 'abcdef',
        speaker_code: 'abcdef',
        sessionId: 'sess-one',
        fromSessionId: 'sess-two',
        toSessionId: 'sess-three',
        studioSession: 'sess-four',
        password: 'hunter2',
        currentPassword: 'hunter2',
        newPassword: 'hunter3',
        passwordHash: 'scrypt$...',
      },
      'handshake accepted',
    );

    const serialized = JSON.stringify(records[0]);
    for (const value of [
      '123456',
      'abcdef',
      'sess-one',
      'sess-two',
      'sess-three',
      'sess-four',
      'hunter2',
      'hunter3',
      'scrypt$...',
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it('censors every spelling one level down, where a payload puts it', () => {
    const log = logger('socket');
    // The depth a handshake, a request body and a handover payload actually use: the
    // secret arrives inside the object the call site is already logging, not beside it.
    log.info({ handshake: { pin: '123456', speakerCode: 'abcdef', studioSession: 'opaque' } }, 'a');
    log.info({ payload: { speaker_code: 'abcdef', sessionId: 'opaque' } }, 'b');
    log.info({ handover: { fromSessionId: 'opaque', toSessionId: 'opaque' } }, 'c');
    log.info({ body: { password: 'hunter2', currentPassword: 'hunter2', newPassword: 'h3' } }, 'd');
    log.info({ account: { passwordHash: 'scrypt$...' } }, 'e');

    const serialized = JSON.stringify(records);
    for (const value of ['123456', 'abcdef', 'opaque', 'hunter2', 'h3', 'scrypt$...']) {
      expect(serialized).not.toContain(value);
    }
    expect(records).toHaveLength(5);
  });

  it('keeps the rest of the payload the secret arrived in', () => {
    logger('socket').info({ handshake: { pin: '123456', clientVersion: '0.11.0' } }, 'handshake');

    const serialized = JSON.stringify(records[0]);
    expect(serialized).not.toContain('123456');
    expect(serialized).toContain('0.11.0');
  });

  it('cannot censor a secret interpolated into the message', () => {
    // Not a gap to close here but the reason values are fields: pino redacts serialized
    // field paths and never reads `msg`, so this guard proves the fields are safe and
    // says nothing about a call site that builds a sentence instead.
    logger('socket').info(`pin 123456 accepted`);

    expect(String(records[0]?.msg)).toContain('123456');
  });

  it('leaves a field that merely resembles a secret alone', () => {
    logger('socket').info({ pinned: 'yes', passwordPolicy: 'strong' }, 'settings');

    expect(records[0]).toMatchObject({ pinned: 'yes', passwordPolicy: 'strong' });
  });
});

describe('warnOnce', () => {
  it('emits on the first call for a key and stays silent afterwards', () => {
    const log = logger('proxy');
    for (let i = 0; i < 100; i++) {
      log.warnOnce(
        'once:first',
        null,
        { header: 'x-forwarded-for' },
        'the proxy appends no header',
      );
    }

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      msg: 'the proxy appends no header',
      header: 'x-forwarded-for',
      subsystem: 'proxy',
    });
  });

  it('tracks two keys independently', () => {
    const log = logger('proxy');
    log.warnOnce('once:a', null, {}, 'first shape');
    log.warnOnce('once:b', null, {}, 'second shape');
    log.warnOnce('once:a', null, {}, 'first shape');

    expect(records).toHaveLength(2);
  });

  it('stops recording new keys past its cap, so a varying key cannot grow without bound', () => {
    const log = logger('proxy');
    for (let i = 0; i < 200; i++) {
      log.warnOnce('once:cap', String(i), { address: `198.51.100.${i}` }, 'unlisted address');
    }

    expect(records.length).toBeLessThan(200);
    log.warnOnce('once:cap', '0', { address: '198.51.100.0' }, 'unlisted address');

    expect(records.filter((record) => record.address === '198.51.100.0')).toHaveLength(1);
  });

  it('caps each key family separately, so a full one cannot silence a quiet one', () => {
    const log = logger('proxy');
    for (let i = 0; i < 200; i++) {
      log.warnOnce('once:varying', String(i), { address: `198.51.100.${i}` }, 'unlisted address');
    }
    records = [];

    log.warnOnce('once:fixed', null, {}, 'the condition nobody has reported yet');

    expect(records).toHaveLength(1);
    expect(records[0]?.msg).toBe('the condition nobody has reported yet');
  });

  it('shares its keys across loggers, so a per-call-site logger still warns once', () => {
    logger('proxy').warnOnce('once:shared', null, {}, 'same condition');
    logger('proxy').warnOnce('once:shared', null, {}, 'same condition');

    expect(records).toHaveLength(1);
  });

  it('holds the cap when the discriminator is an address carrying separators', () => {
    const log = logger('proxy');
    for (let i = 0; i < 200; i++) {
      log.warnOnce(
        'once:v6',
        `2001:db8:1:${i}::1`,
        { address: `2001:db8:1:${i}::1` },
        'unlisted address',
      );
    }

    expect(records.length).toBeLessThanOrEqual(50);
  });
});

describe('the transport targets', () => {
  it('constructs stdout alone when no log directory is configured', () => {
    const targets = logTargets('info', '', false);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.target).toBe('pino-pretty');
  });

  it('gives each target the level the root logger was given', () => {
    for (const target of logTargets('trace', '/data/logs', false)) {
      expect(target.level).toBe('trace');
    }
  });

  it('rotates the file daily, dates it, and keeps a fortnight', () => {
    const file = logTargets('info', '/data/logs', false).find(
      (target) => target.target === 'pino-roll',
    );

    expect(file?.options).toMatchObject({
      file: '/data/logs/hallspeak.log',
      frequency: 'daily',
      dateFormat: 'yyyy-MM-dd',
      limit: { count: 14, removeOtherLogFiles: true },
    });
  });

  it('passes the colour choice through', () => {
    expect(logTargets('info', '', false)[0]?.options.colorize).toBe(false);
    expect(logTargets('info', '', true)[0]?.options.colorize).toBe(true);
  });
});

describe('the log directory', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      chmodSync(directory, 0o700);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates a directory that does not exist yet', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'hallspeak-log-'));
    directories.push(parent);
    const directory = path.join(parent, 'logs');

    expect(prepareLogDirectory(directory)).toBe(directory);
  });

  it('reports once and declines the file target when the directory is unusable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parent = mkdtempSync(path.join(tmpdir(), 'hallspeak-log-'));
    directories.push(parent);
    chmodSync(parent, 0o500);

    expect(prepareLogDirectory(path.join(parent, 'logs'))).toBe('');
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('continuing on stdout alone');
  });

  it('declines the file target when no directory is configured', () => {
    expect(prepareLogDirectory('')).toBe('');
  });
});
