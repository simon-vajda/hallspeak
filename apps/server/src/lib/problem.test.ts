import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'trace', LOG_DIR: '' },
}));
vi.mock('../env', () => ({ env: envMock }));

const { useLogDestination } = await import('./log');
const { AppError, toProblem } = await import('./problem');

const PIN = '481902';
const SPEAKER_CODE = 'GLASS-OTTER';
const STUDIO_SESSION = 'ssn_7f3a9c1e';

let records: Record<string, unknown>[];

beforeEach(() => {
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

const written = () => JSON.stringify(records);

describe('toProblem', () => {
  it('keeps an AppError on the wire and logs nothing', () => {
    expect(toProblem(new AppError('channel_taken', 'Somebody else is broadcasting.'))).toEqual({
      code: 'channel_taken',
      message: 'Somebody else is broadcasting.',
    });
    expect(records).toHaveLength(0);
  });

  it('hides anything else behind internal_error', () => {
    expect(toProblem(new Error('the router rejected it'))).toEqual({
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    });
  });

  it('logs the name, message and stack of a thrown Error as fields', () => {
    toProblem(new TypeError('cannot read properties of undefined'));

    expect(records[0]).toMatchObject({
      subsystem: 'error',
      msg: 'unhandled error',
      err: { message: 'cannot read properties of undefined' },
    });
    // The class name survives in the stack, which is where an operator reads it.
    expect(String((records[0]?.err as { stack?: string } | undefined)?.stack)).toContain(
      'TypeError',
    );
  });

  it('reproduces no credential carried on the thrown value', () => {
    const err = Object.assign(new Error('produce failed'), {
      pin: PIN,
      speakerCode: SPEAKER_CODE,
      studioSession: STUDIO_SESSION,
      payload: { pin: PIN },
    });

    toProblem(err);

    expect(written()).toContain('produce failed');
    expect(written()).not.toContain(PIN);
    expect(written()).not.toContain(SPEAKER_CODE);
    expect(written()).not.toContain(STUDIO_SESSION);
  });

  it('reproduces nothing but the type from a non-Error thrown value', () => {
    toProblem({ pin: PIN, speakerCode: SPEAKER_CODE });

    expect(written()).not.toContain(PIN);
    expect(written()).not.toContain(SPEAKER_CODE);
    expect(records[0]).toMatchObject({ msg: 'unhandled non-Error thrown', thrownType: 'object' });
  });

  it('writes at error, so a failure is visible at any level an operator runs', () => {
    toProblem(new Error('boom'));

    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe(50);
    expect(String(records[0]?.time)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});
